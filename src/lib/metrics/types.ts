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
}

export type Rates = {
  qualificacao: number | null
  agendamento: number | null
  comparecimento: number | null
  conversaoConsulta: number | null
}

export type GoalStatus = 'abaixo' | 'na_meta' | 'acima' | 'sem_meta'
