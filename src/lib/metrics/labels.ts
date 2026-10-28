import type { MetricKey } from './types'

export const METRIC_LABELS: Record<MetricKey, string> = {
  leads: 'Leads',
  leads_qualificados: 'Leads qualificados',
  consultas_agendadas: 'Consultas agendadas',
  comparecimentos: 'Comparecimentos',
  vendas: 'Vendas',
  consultas_novas: 'Consultas novas',
  faturamento_consultas: 'Faturamento em consultas',
  faturamento_tratamentos: 'Faturamento em tratamentos',
  faturamento_total: 'Faturamento total',
}

export const MONEY_METRICS: ReadonlySet<MetricKey> = new Set<MetricKey>([
  'faturamento_consultas',
  'faturamento_tratamentos',
  'faturamento_total',
])
