import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import { ghlCredentials, ghlGet, ghlPages } from './client'
import { EVENTOS_DIAS_FUTURO, EVENTOS_DIAS_PASSADO, VENDEDORES_IDS } from './config'
import {
  mapContact,
  mapEvent,
  mapOpportunity,
  mapUser,
  type AgendamentoRow,
  type ContatoRow,
  type OportunidadeRow,
  type UsuarioRow,
} from './mappers'

type Raw = Record<string, unknown>
export type SyncCounts = {
  usuarios: number
  contatos: number
  oportunidades: number
  agendamentos: number
  agendamentosExcluidos: number
}

const DIA_MS = 86_400_000
const JANELA_EVENTOS_MS = 90 * DIA_MS

async function upsert(admin: SupabaseClient, table: string, rows: unknown[]) {
  if (rows.length === 0) return
  const { error } = await admin.from(table).upsert(rows, { onConflict: 'id' })
  if (error) throw new Error(`Falha ao gravar ${table}: ${error.message}`)
}

// O upsert só grava e atualiza: um registro excluído no GHL (ex.: um agendamento de teste
// apagado do calendário) nunca some do nosso banco sozinho, porque nenhuma chamada de sync volta
// a mencionar o id dele. Depois de sincronizar uma janela de datas inteira, isso apaga do banco
// quem está nessa mesma janela mas não veio na resposta do GHL dessa vez. Só mexe na janela que
// acabou de ser sincronizada (pela mesma coluna de data usada no filtro da chamada ao GHL), nunca
// em registros de fora dela.
async function removerAusentes(
  admin: SupabaseClient,
  table: string,
  colunaData: string,
  desde: string,
  ate: string,
  idsVistos: ReadonlySet<string>,
): Promise<number> {
  const { data: existentes, error } = await admin.from(table).select('id').gte(colunaData, desde).lt(colunaData, ate)
  if (error) throw new Error(`Falha ao conferir ${table}: ${error.message}`)
  const idsParaExcluir = (existentes ?? []).map((r) => r.id as string).filter((id) => !idsVistos.has(id))
  if (idsParaExcluir.length === 0) return 0
  const { error: delError } = await admin.from(table).delete().in('id', idsParaExcluir)
  if (delError) throw new Error(`Falha ao excluir ${table}: ${delError.message}`)
  return idsParaExcluir.length
}

// Colunas de oportunidades criadas por migrations recentes. Se o banco ainda não as tem, o sync segue
// sem elas, em vez de falhar inteiro (o dashboard avisa que o banco está desatualizado).
const COLUNAS_OPCIONAIS = ['valor_tratamento', 'etapa_alterada_em'] as const

async function colunasAusentes(admin: SupabaseClient) {
  const ausentes: string[] = []
  for (const coluna of COLUNAS_OPCIONAIS) {
    const { error } = await admin.from('oportunidades').select(coluna).limit(1)
    if (error) ausentes.push(coluna)
  }
  return ausentes
}

function semColunas(row: OportunidadeRow, ausentes: string[]): Partial<OportunidadeRow> {
  const copia: Record<string, unknown> = { ...row }
  for (const coluna of ausentes) delete copia[coluna]
  return copia as Partial<OportunidadeRow>
}

// Sync completo e idempotente: rodar duas vezes não duplica registros.
export async function runSync(admin: SupabaseClient): Promise<SyncCounts> {
  const { locationId } = ghlCredentials()
  const counts: SyncCounts = { usuarios: 0, contatos: 0, oportunidades: 0, agendamentos: 0, agendamentosExcluidos: 0 }

  // Usuários (vendedores definidos por GHL_VENDEDORES_IDS)
  const userRes = await ghlGet<{ users?: Raw[] }>(`/users/?locationId=${locationId}`)
  const usuarios = (userRes.users ?? [])
    .map((u) => mapUser(u, VENDEDORES_IDS))
    .filter((r): r is UsuarioRow => r !== null)
  await upsert(admin, 'usuarios', usuarios)
  counts.usuarios = usuarios.length

  // Pipelines (nome do pipeline de cada oportunidade)
  const pipelineRes = await ghlGet<{ pipelines?: { id: string; name: string }[] }>(
    `/opportunities/pipelines?locationId=${locationId}`,
  )
  const pipelineNames = new Map((pipelineRes.pipelines ?? []).map((p) => [p.id, p.name]))

  // Contatos
  const contatosComTratamento = new Set<string>()
  for await (const page of ghlPages<Raw>(`/contacts/?locationId=${locationId}&limit=100`, 'contacts')) {
    const rows = page.map(mapContact).filter((r): r is ContatoRow => r !== null)
    for (const r of rows) if (r.data_inicio_tratamento) contatosComTratamento.add(r.id)
    await upsert(admin, 'contatos', rows)
    counts.contatos += rows.length
  }

  // Oportunidades
  const ctx = { pipelineNames, contatosComTratamento }
  const ausentes = await colunasAusentes(admin)
  for await (const page of ghlPages<Raw>(
    `/opportunities/search?location_id=${locationId}&limit=100`,
    'opportunities',
  )) {
    const rows = page.map((o) => mapOpportunity(o, ctx)).filter((r): r is OportunidadeRow => r !== null)
    await upsert(admin, 'oportunidades', ausentes.length === 0 ? rows : rows.map((r) => semColunas(r, ausentes)))
    counts.oportunidades += rows.length
  }

  // Agendamentos (eventos de cada calendário, em janelas de 90 dias)
  const calendarRes = await ghlGet<{ calendars?: { id: string }[] }>(
    `/calendars/?locationId=${locationId}`,
  )
  const agora = Date.now()
  const inicio = agora - EVENTOS_DIAS_PASSADO * DIA_MS
  const fim = agora + EVENTOS_DIAS_FUTURO * DIA_MS
  const idsVistos = new Set<string>()
  for (const cal of calendarRes.calendars ?? []) {
    for (let de = inicio; de < fim; de += JANELA_EVENTOS_MS) {
      const ate = Math.min(de + JANELA_EVENTOS_MS, fim)
      const res = await ghlGet<{ events?: Raw[] }>(
        `/calendars/events?locationId=${locationId}&calendarId=${cal.id}&startTime=${de}&endTime=${ate}`,
      )
      const rows = (res.events ?? []).map(mapEvent).filter((r): r is AgendamentoRow => r !== null)
      for (const r of rows) idsVistos.add(r.id)
      await upsert(admin, 'agendamentos', rows)
      counts.agendamentos += rows.length
    }
  }
  counts.agendamentosExcluidos = await removerAusentes(
    admin,
    'agendamentos',
    'data_inicio',
    new Date(inicio).toISOString(),
    new Date(fim).toISOString(),
    idsVistos,
  )

  return counts
}
