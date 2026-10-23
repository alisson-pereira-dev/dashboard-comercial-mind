import type { SupabaseClient } from '@supabase/supabase-js'
import { ETAPAS_CONSULTA_IDS, PIPELINE_FUNIL, VALOR_CONSULTA } from '@/lib/ghl/config'
import { contaGanhas, faturamentoConsultas, type OportunidadeConsulta } from '@/lib/metrics/faturamento'
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

type MetaRow = { metrica: string; valor: number | string; mes_referencia: string }

// Meta do período = soma das metas dos meses tocados, cada uma pela fração de dias dentro do período.
function somarMetas(period: Period, rows: MetaRow[]): Record<MetricKey, number | null> {
  const metas = Object.fromEntries(METRIC_KEYS.map((k) => [k, null])) as Record<MetricKey, number | null>
  const pesos = new Map(period.metaPesos.map((p) => [p.mes, p.fracao]))
  for (const m of rows) {
    const key = m.metrica as MetricKey
    const parte = Number(m.valor) * (pesos.get(m.mes_referencia) ?? 0)
    metas[key] = Math.round(((metas[key] ?? 0) + parte) * 100) / 100
  }
  return metas
}

// Resposta da função dashboard_resumo (supabase/migrations/20261023000002).
type Resumo = {
  leads: number
  leads_qualificados: number
  consultas_agendadas: number
  comparecimentos: number
  vendas: number
  vendas_valor: number | string
  vendas_padrao: number
  leads_padrao: number
  consultas_n: number
  consultas_ganhas: number
  tem_dados: boolean
  metas: MetaRow[]
  ultimo_sync: { status: 'rodando' | 'ok' | 'erro'; iniciado_em: string; finalizado_em: string | null; erro: string | null } | null
  ultimo_sync_ok: string | null
}

// Se a função não existe no banco, não vale tentar de novo a cada pedido: lembra por alguns minutos.
let semFuncaoAte = 0
const SEM_FUNCAO_MS = 5 * 60 * 1000

// vendedorId = null mostra a clínica toda e usa as metas gerais (usuario_id = 'clinica').
// Uma única ida ao banco (função dashboard_resumo); sem ela, cai no caminho antigo.
export async function getDashboardData(
  supabase: SupabaseClient,
  period: Period,
  vendedorId: string | null = null,
): Promise<DashboardData> {
  if (Date.now() >= semFuncaoAte) {
    const { data, error } = await supabase.rpc('dashboard_resumo', {
      p_inicio: period.fromIso,
      p_fim: period.toIso,
      p_vendedor: vendedorId,
      p_pipeline: PIPELINE_FUNIL,
      p_etapas: ETAPAS_CONSULTA_IDS,
      p_meses: period.metaPesos.map((p) => p.mes),
    })
    // Versão antiga da função (migration 000002, sem vendas_valor): usa o caminho antigo.
    if (!error && data && 'vendas_valor' in (data as object)) {
      const r = data as Resumo
      const consultasValor = faturamentoConsultas(r.consultas_agendadas, r.comparecimentos, VALOR_CONSULTA)
      const tratamentoValor = Number(r.vendas_valor)
      const s = r.ultimo_sync
      return {
        realizado: {
          leads: r.leads,
          leads_qualificados: r.leads_qualificados,
          consultas_agendadas: r.consultas_agendadas,
          comparecimentos: r.comparecimentos,
          vendas: r.vendas,
          faturamento_consultas: consultasValor,
          faturamento_tratamentos: tratamentoValor,
          faturamento_total: consultasValor + tratamentoValor,
          consultas_novas: r.consultas_n,
          tratamentosNovos: r.consultas_ganhas,
        },
        metas: somarMetas(period, r.metas),
        ultimoSync: s
          ? { status: s.status, iniciadoEm: s.iniciado_em, finalizadoEm: s.finalizado_em, erro: s.erro }
          : null,
        ultimoSyncOk: r.ultimo_sync_ok,
        temDados: r.tem_dados,
        atribuicaoPadrao: { leads: r.leads_padrao, vendas: r.vendas_padrao },
      }
    }
    // PGRST202 = função não encontrada: migration ainda não rodada.
    if (error?.code === 'PGRST202') semFuncaoAte = Date.now() + SEM_FUNCAO_MS
  }
  return getDashboardDataLegacy(supabase, period, vendedorId)
}

// Caminho antigo: cerca de 13 consultas separadas por período. Fica como reserva para quando a função
// dashboard_resumo ainda não existe no banco (migration por rodar). Mesmas regras da função.
async function getDashboardDataLegacy(
  supabase: SupabaseClient,
  period: Period,
  vendedorId: string | null = null,
): Promise<DashboardData> {
  const { fromIso, toIso } = period
  const head = { count: 'exact', head: true } as const
  // O tipo do builder do Supabase é profundo demais para um genérico com restrição.
  const por = <T,>(q: T): T =>
    vendedorId ? (q as unknown as { eq(c: string, v: string): T }).eq('responsavel_id', vendedorId) : q

  // Oportunidades criadas no período que estão nas etapas de consulta do pipeline do funil. Dela saem:
  // - consultas novas: quantas são;
  // - tratamentos novos: quantas já estão ganhas (consulta feita e convertida em tratamento).
  // O faturamento em consultas NÃO vem daqui: é calculado pelos agendamentos (faturamentoConsultas).
  const contagemConsultas = async (): Promise<{ oportunidades: number; ganhas: number }> => {
    const { data, error } = await por(
      supabase
        .from('oportunidades')
        .select('status')
        .eq('pipeline_nome', PIPELINE_FUNIL)
        .in('estagio_id', ETAPAS_CONSULTA_IDS)
        .gte('criado_em', fromIso)
        .lt('criado_em', toIso)
        .limit(5000),
    )
    if (error) throw new Error(error.message)
    const linhas = (data ?? []) as unknown as OportunidadeConsulta[]
    return { oportunidades: linhas.length, ganhas: contaGanhas(linhas) }
  }

  const [
    leads,
    qualificados,
    agendadas,
    comparecimentos,
    vendasRes,
    consultasContagem,
    metasRes,
    syncRes,
    okRes,
    totalContatos,
    leadsPadrao,
  ] = await Promise.all([
      count(
        por(
          supabase
            .from('oportunidades')
            .select('id', head)
            .eq('pipeline_nome', PIPELINE_FUNIL)
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
            .eq('pipeline_nome', PIPELINE_FUNIL)
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
            .gte('criado_em', fromIso)
            .lt('criado_em', toIso),
        ),
      ),
      por(
        supabase
          .from('oportunidades')
          .select('valor, responsavel_padrao')
          .eq('status', 'ganha')
          .eq('pipeline_nome', PIPELINE_FUNIL)
          .gte('criado_em', fromIso)
          .lt('criado_em', toIso)
          .limit(5000),
      ),
      contagemConsultas(),
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
              .from('oportunidades')
              .select('id', head)
              .eq('pipeline_nome', PIPELINE_FUNIL)
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
  // Em tratamentos: valor das oportunidades ganhas do período (as mesmas das vendas).
  const faturamentoTratamentos = vendas.reduce((acc, v) => acc + Number(v.valor), 0)

  const faturamentoDeConsultas = faturamentoConsultas(agendadas, comparecimentos, VALOR_CONSULTA)

  const realizado: Realizado = {
    leads,
    leads_qualificados: qualificados,
    consultas_agendadas: agendadas,
    comparecimentos,
    vendas: vendas.length,
    faturamento_consultas: faturamentoDeConsultas,
    faturamento_tratamentos: faturamentoTratamentos,
    faturamento_total: faturamentoDeConsultas + faturamentoTratamentos,
    consultas_novas: consultasContagem.oportunidades,
    tratamentosNovos: consultasContagem.ganhas,
  }

  const metas = somarMetas(period, metasRes.data ?? [])

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
