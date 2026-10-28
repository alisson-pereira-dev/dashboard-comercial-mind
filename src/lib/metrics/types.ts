export const METRIC_KEYS = [
  'leads',
  'leads_qualificados',
  'consultas_agendadas',
  'comparecimentos',
  'vendas',
  'consultas_novas',
  'tratamentos_novos',
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
  /** Ganhas (no período) na etapa Consulta Agendada. Numerador da taxa de conversão na consulta. */
  fechamentosConsulta: number
  /** Ganhas (no período) na etapa Pós consulta. Numerador da taxa de conversão pós consulta. */
  fechamentosFollowup: number
  /** Oportunidades que ESTÃO na etapa Pós consulta. Denominador da taxa de conversão pós consulta. */
  posConsultaN: number
}

export type Rates = {
  qualificacao: number | null
  /** Consultas agendadas / leads qualificados (MQL para consulta). */
  agendamento: number | null
  /** Consultas agendadas / leads totais (lead direto para consulta). */
  agendamentoLead: number | null
  comparecimento: number | null
  /**
   * Fechamentos em consulta / consultas agendadas (decisão de 27/10/2026, 2ª correção: a base é a própria
   * etapa, não mais comparecimentos nem vendas). Mostra quantos dos que chegaram à etapa Consulta Agendada
   * foram dados como ganho ali mesmo.
   */
  conversaoConsulta: number | null
  /** Fechamentos em follow up / oportunidades na etapa Pós consulta. Mesma lógica, para a etapa seguinte. */
  conversaoPosConsulta: number | null
}

export type GoalStatus = 'abaixo' | 'na_meta' | 'acima' | 'sem_meta'
