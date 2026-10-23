import type { SupabaseClient } from '@supabase/supabase-js'
import { PIPELINE_FUNIL } from '@/lib/ghl/config'
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
  /** Contexto do faturamento, para a tela explicar um valor zerado. */
  faturamento: {
    /** false quando o banco ainda não tem a coluna valor_tratamento (migration por rodar). */
    tratamentoDisponivel: boolean
    /** Oportunidades criadas no período com o campo Valor do tratamento preenchido. */
    oportunidadesComValorTratamento: number
  }
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

  // Faturamento em consultas: valor da oportunidade (pipeline do funil) de cada contato com
  // agendamento 'compareceu' criado no período. Cada oportunidade conta uma vez.
  const valorDasConsultas = async (): Promise<number> => {
    // Sem filtro de vendedor aqui: quem recebe o valor é o responsável pela oportunidade.
    const { data: ags, error } = await supabase
      .from('agendamentos')
      .select('contato_id')
      .eq('status', 'compareceu')
      .gte('criado_em', fromIso)
      .lt('criado_em', toIso)
      .limit(5000)
    if (error) throw new Error(error.message)
    const contatos = [...new Set((ags ?? []).map((a) => a.contato_id).filter((c): c is string => Boolean(c)))]
    const valores = new Map<string, number>()
    for (let i = 0; i < contatos.length; i += 100) {
      const { data, error: e } = await por(
        supabase
          .from('oportunidades')
          .select('id, valor')
          .eq('pipeline_nome', PIPELINE_FUNIL)
          .in('contato_id', contatos.slice(i, i + 100)),
      )
      if (e) throw new Error(e.message)
      for (const o of data ?? []) valores.set(o.id, Number(o.valor))
    }
    return [...valores.values()].reduce((acc, v) => acc + v, 0)
  }

  const [
    leads,
    qualificados,
    agendadas,
    comparecimentos,
    vendasRes,
    consultasValor,
    tratamentoRes,
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
          .select('valor, tipo, responsavel_padrao')
          .eq('status', 'ganha')
          .eq('pipeline_nome', PIPELINE_FUNIL)
          .gte('criado_em', fromIso)
          .lt('criado_em', toIso)
          .limit(5000),
      ),
      valorDasConsultas(),
      // Faturamento em tratamentos: campo Valor do tratamento das oportunidades criadas no período.
      // Sem a coluna no banco (migration por rodar) a consulta falha e o valor fica indisponível.
      por(
        supabase
          .from('oportunidades')
          .select('valor_tratamento')
          .eq('pipeline_nome', PIPELINE_FUNIL)
          .not('valor_tratamento', 'is', null)
          .gte('criado_em', fromIso)
          .lt('criado_em', toIso)
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
  const consultas = vendas.filter((v) => v.tipo !== 'tratamento')
  const tratamentos = vendas.filter((v) => v.tipo === 'tratamento')
  const tratamentoDisponivel = !tratamentoRes.error
  const comValorTratamento = tratamentoDisponivel ? (tratamentoRes.data ?? []) : []
  const faturamentoTratamentos = comValorTratamento.reduce((acc, r) => acc + Number(r.valor_tratamento), 0)

  const realizado: Realizado = {
    leads,
    leads_qualificados: qualificados,
    consultas_agendadas: agendadas,
    comparecimentos,
    vendas: vendas.length,
    faturamento_consultas: consultasValor,
    faturamento_tratamentos: faturamentoTratamentos,
    faturamento_total: consultasValor + faturamentoTratamentos,
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
    faturamento: { tratamentoDisponivel, oportunidadesComValorTratamento: comValorTratamento.length },
  }
}
