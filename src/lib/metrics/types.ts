export const METRIC_KEYS = [
  'leads',
  'leads_qualificados',
  'consultas_agendadas',
  'comparecimentos',
  'vendas',
  'consultas_novas',
  'faturamento_consultas',
  'faturamento_tratamentos',
  'faturamento_total',
] as const

export type MetricKey = (typeof METRIC_KEYS)[number]

export type Funnel = {
  leads: number
  leadsQualificados: number
  consultasAgendadas: number
  comparecimentos: number
  vendas: number
  /** Ganhas (no período) na etapa Consulta Agendada. Base da taxa de conversão na consulta. */
  fechamentosConsulta: number
  /** Ganhas (no período) na etapa Pós consulta. Base da taxa de conversão pós consulta. */
  fechamentosFollowup: number
}

export type Rates = {
  qualificacao: number | null
  /** Consultas agendadas / leads qualificados (MQL para consulta). */
  agendamento: number | null
  /** Consultas agendadas / leads totais (lead direto para consulta). */
  agendamentoLead: number | null
  comparecimento: number | null
  /** Fechamentos em consulta / comparecimentos (decisão de 27/10/2026; antes era vendas / comparecimentos). */
  conversaoConsulta: number | null
  /** Fechamentos em follow up / comparecimentos. */
  conversaoPosConsulta: number | null
}

export type GoalStatus = 'abaixo' | 'na_meta' | 'acima' | 'sem_meta'
