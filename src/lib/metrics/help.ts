import type { MetricKey } from './types'

// Texto do "!" de cada número. Mantenha em sincronia com src/lib/dashboard/queries.ts.
export const METRIC_HELP: Record<MetricKey, string> = {
  leads: 'Oportunidades criadas dentro do período no pipeline Qualificação (IA) do GHL.',
  leads_qualificados:
    'Oportunidades do pipeline Qualificação (IA) criadas no período com o campo TRAQ MQL marcado.',
  consultas_agendadas:
    'Agendamentos do calendário criados no período. Os cancelados não entram.',
  comparecimentos:
    'Agendamentos marcados como "compareceu" no calendário, criados dentro do período (data "criado em" do GHL).',
  vendas:
    'Oportunidades do pipeline Qualificação (IA) que foram criadas dentro do período (data "criado em" do GHL) e estão ganhas.',
  consultas_novas:
    'Oportunidades do pipeline Qualificação (IA) criadas no período que estão nas etapas Consulta Agendada e Pós consulta.',
  faturamento_consultas:
    'Soma do valor das oportunidades do pipeline Qualificação (IA) criadas dentro do período que estão nas etapas Consulta Agendada e Pós consulta. Quando há tratamento fechado, o valor do tratamento é descontado, para ele não contar duas vezes.',
  faturamento_tratamentos:
    'Soma do campo "Valor do tratamento" das oportunidades do pipeline Qualificação (IA) criadas dentro do período. É um campo próprio, diferente do valor da oportunidade.',
  faturamento_total: 'Faturamento em consultas mais faturamento em tratamentos.',
}

export const EXTRA_HELP = {
  tratamentosNovos:
    'Oportunidades criadas no período que passaram pela etapa de consulta (Consulta Agendada ou Pós consulta) e estão marcadas como ganhas: consulta feita e convertida em tratamento.',
  metaFaturamento:
    'Quanto do faturamento total já foi feito em relação à meta cadastrada para o período.',
  qualificacao: 'Leads qualificados divididos pelos leads. Mostra quantos leads viram MQL.',
  agendamento:
    'Consultas agendadas divididas pelos leads qualificados. Mostra quantos MQL chegam a marcar consulta.',
  agendamentoLead:
    'Consultas agendadas divididas pelos leads totais. Mostra quantos leads chegam a marcar consulta, sem passar pela qualificação.',
  comparecimento:
    'Comparecimentos divididos pelas consultas agendadas. Mostra quantas consultas marcadas acontecem.',
  conversaoConsulta:
    'Vendas divididas pelos comparecimentos. Mostra quantas consultas realizadas viram venda.',
} as const
