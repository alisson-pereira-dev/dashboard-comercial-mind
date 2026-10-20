import type { SupabaseClient } from '@supabase/supabase-js'
import { PIPELINES_FORA_DO_FUNIL } from '@/lib/ghl/config'
import { METRIC_KEYS, type MetricKey, type Period } from '@/lib/metrics'

export type Realizado = Record<MetricKey, number> & {
  tratamentosNovos: number
}

export type SyncInfo = {
  status: 'rodando' | 'ok' | 'erro'
  iniciadoEm: string
  finalizadoEm: string | null
  erro: string | null
} | null

export type DashboardData = {
  realizado: Realizado
  metas: Record<MetricKey, number | null>
  ultimoSync: SyncInfo
  ultimoSyncOk: string | null
  temDados: boolean
  /** Registros do período que estavam sem responsável no GHL e foram atribuídos ao vendedor padrão. */
  atribuicaoPadrao: { leads: number; vendas: number }
}

function foraDoFunil() {
  return `(${PIPELINES_FORA_DO_FUNIL.map((p) => `"${p}"`).join(',')})`
}

async function count(
  query: PromiseLike<{ count: number | null; error: { message: string } | null }>,
): Promise<number> {
  const { count: n, error } = await query
  if (error) throw new Error(error.message)
  return n ?? 0
}

export type Vendedor = { id: string; nome: string }

export async function getVendedores(supabase: SupabaseClient): Promise<Vendedor[]> {
  const { data, error } = await supabase
    .from('usuarios')
    .select('id, nome')
    .eq('vendedor', true)
    .eq('ativo', true)
    .order('nome')
  if (error) throw new Error(error.message)
  return data ?? []
}

// Metas cadastradas de um mês para uma pessoa ('clinica' = meta geral). Vazio = sem meta.
export async function getMetasDoMes(
  supabase: SupabaseClient,
  mes: string,
  usuarioId: string,
): Promise<Record<MetricKey, string>> {
  const { data, error } = await supabase
    .from('metas')
    .select('metrica, valor')
    .eq('mes_referencia', `${mes}-01`)
    .eq('usuario_id', usuarioId)
  if (error) throw new Error(error.message)
  const porMetrica = new Map((data ?? []).map((m) => [m.metrica as string, String(Number(m.valor))]))
  return Object.fromEntries(METRIC_KEYS.map((k) => [k, porMetrica.get(k) ?? ''])) as Record<MetricKey, string>
}

// vendedorId = null mostra a clínica toda e usa as metas gerais (usuario_id = 'clinica').
export async function getDashboardData(
  supabase: SupabaseClient,
  period: Period,
  vendedorId: string | null = null,
): Promise<DashboardData> {
  const { fromIso, toIso } = period
  const head = { count: 'exact', head: true } as const
  // O tipo do builder do Supabase é profundo demais para um genérico com restrição.
  const por = <T,>(q: T): T =>
    vendedorId ? (q as unknown as { eq(c: string, v: string): T }).eq('responsavel_id', vendedorId) : q

  const [
    leads,
    qualificados,
    agendadas,
    comparecimentos,
    vendasRes,
    metasRes,
    syncRes,
    okRes,
    totalContatos,
    leadsPadrao,
  ] = await Promise.all([
      count(
        por(
          supabase
            .from('contatos')
            .select('id', head)
            .gte('criado_em', fromIso)
            .lt('criado_em', toIso),
        ),
      ),
      count(
        por(
          supabase
            .from('oportunidades')
            .select('id', head)
            .eq('mql', true)
            .not('pipeline_nome', 'in', foraDoFunil())
            .gte('criado_em', fromIso)
            .lt('criado_em', toIso),
        ),
      ),
      count(
        por(
          supabase
            .from('agendamentos')
            .select('id', head)
            .neq('status', 'cancelado')
            .gte('criado_em', fromIso)
            .lt('criado_em', toIso),
        ),
      ),
      count(
        por(
          supabase
            .from('agendamentos')
            .select('id', head)
            .eq('status', 'compareceu')
            .gte('data_inicio', fromIso)
            .lt('data_inicio', toIso),
        ),
      ),
      por(
        supabase
          .from('oportunidades')
          .select('valor, tipo, responsavel_padrao')
          .eq('status', 'ganha')
          .not('pipeline_nome', 'in', foraDoFunil())
          .gte('fechado_em', fromIso)
          .lt('fechado_em', toIso)
          .limit(5000),
      ),
      supabase
        .from('metas')
        .select('metrica, valor, mes_referencia')
        .eq('usuario_id', vendedorId ?? 'clinica')
        .in('mes_referencia', period.metaPesos.map((p) => p.mes)),
      supabase
        .from('sync_runs')
        .select('status, iniciado_em, finalizado_em, erro')
        .order('iniciado_em', { ascending: false })
        .limit(1),
      supabase
        .from('sync_runs')
        .select('finalizado_em')
        .eq('status', 'ok')
        .order('finalizado_em', { ascending: false })
        .limit(1),
      count(supabase.from('contatos').select('id', head)),
      vendedorId
        ? count(
            supabase
              .from('contatos')
              .select('id', head)
              .eq('responsavel_id', vendedorId)
              .eq('responsavel_padrao', true)
              .gte('criado_em', fromIso)
              .lt('criado_em', toIso),
          )
        : Promise.resolve(0),
  ])

  if (vendasRes.error) throw new Error(vendasRes.error.message)
  if (metasRes.error) throw new Error(metasRes.error.message)

  const vendas = vendasRes.data ?? []
  const consultas = vendas.filter((v) => v.tipo !== 'tratamento')
  const tratamentos = vendas.filter((v) => v.tipo === 'tratamento')
  const soma = (rows: { valor: number | string }[]) =>
    rows.reduce((acc, r) => acc + Number(r.valor), 0)

  const realizado: Realizado = {
    leads,
    leads_qualificados: qualificados,
    consultas_agendadas: agendadas,
    comparecimentos,
    vendas: vendas.length,
    faturamento_consultas: soma(consultas),
    faturamento_tratamentos: soma(tratamentos),
    faturamento_total: soma(vendas),
    consultas_novas: consultas.length,
    tratamentosNovos: tratamentos.length,
  }

  const metas = Object.fromEntries(METRIC_KEYS.map((k) => [k, null])) as Record<
    MetricKey,
    number | null
  >
  // Meta do período = soma das metas dos meses tocados, cada uma pela fração de dias dentro do período.
  const pesos = new Map(period.metaPesos.map((p) => [p.mes, p.fracao]))
  for (const m of metasRes.data ?? []) {
    const key = m.metrica as MetricKey
    const parte = Number(m.valor) * (pesos.get(m.mes_referencia) ?? 0)
    metas[key] = Math.round(((metas[key] ?? 0) + parte) * 100) / 100
  }

  const s = syncRes.data?.[0]
  return {
    realizado,
    metas,
    ultimoSync: s
      ? { status: s.status, iniciadoEm: s.iniciado_em, finalizadoEm: s.finalizado_em, erro: s.erro }
      : null,
    ultimoSyncOk: okRes.data?.[0]?.finalizado_em ?? null,
    temDados: totalContatos > 0,
    atribuicaoPadrao: {
      leads: leadsPadrao,
      vendas: vendas.filter((v) => v.responsavel_padrao).length,
    },
  }
}
