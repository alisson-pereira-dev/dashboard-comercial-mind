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
}

const DIA_MS = 86_400_000
const JANELA_EVENTOS_MS = 90 * DIA_MS

async function upsert(admin: SupabaseClient, table: string, rows: unknown[]) {
  if (rows.length === 0) return
  const { error } = await admin.from(table).upsert(rows, { onConflict: 'id' })
  if (error) throw new Error(`Falha ao gravar ${table}: ${error.message}`)
}

// Sync completo e idempotente: rodar duas vezes não duplica registros.
export async function runSync(admin: SupabaseClient): Promise<SyncCounts> {
  const { locationId } = ghlCredentials()
  const counts: SyncCounts = { usuarios: 0, contatos: 0, oportunidades: 0, agendamentos: 0 }

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
  for await (const page of ghlPages<Raw>(
    `/opportunities/search?location_id=${locationId}&limit=100`,
    'opportunities',
  )) {
    const rows = page.map((o) => mapOpportunity(o, ctx)).filter((r): r is OportunidadeRow => r !== null)
    await upsert(admin, 'oportunidades', rows)
    counts.oportunidades += rows.length
  }

  // Agendamentos (eventos de cada calendário, em janelas de 90 dias)
  const calendarRes = await ghlGet<{ calendars?: { id: string }[] }>(
    `/calendars/?locationId=${locationId}`,
  )
  const agora = Date.now()
  const inicio = agora - EVENTOS_DIAS_PASSADO * DIA_MS
  const fim = agora + EVENTOS_DIAS_FUTURO * DIA_MS
  for (const cal of calendarRes.calendars ?? []) {
    for (let de = inicio; de < fim; de += JANELA_EVENTOS_MS) {
      const ate = Math.min(de + JANELA_EVENTOS_MS, fim)
      const res = await ghlGet<{ events?: Raw[] }>(
        `/calendars/events?locationId=${locationId}&calendarId=${cal.id}&startTime=${de}&endTime=${ate}`,
      )
      const rows = (res.events ?? []).map(mapEvent).filter((r): r is AgendamentoRow => r !== null)
      await upsert(admin, 'agendamentos', rows)
      counts.agendamentos += rows.length
    }
  }

  return counts
}
