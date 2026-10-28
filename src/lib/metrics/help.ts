import type { MetricKey } from './types'

// Texto do "!" de cada número. Mantenha em sincronia com src/lib/dashboard/queries.ts.
export const METRIC_HELP: Record<MetricKey, string> = {
  leads: 'Oportunidades criadas dentro do período no pipeline Qualificação (IA) do GHL.',
  leads_qualificados:
    'Oportunidades do pipeline Qualificação (IA) criadas no período com o campo TRAQ MQL marcado.',
  consultas_agendadas:
    'Oportunidades do pipeline Qualificação (IA) que estão na etapa Consulta Agendada, pela data em que mudaram para essa etapa (última mudança de etapa no GHL).',
  comparecimentos:
    'Agendamentos marcados como "compareceu" no calendário, pela data em que o agendamento foi atualizado no GHL (quando o status foi marcado).',
  vendas:
    'Oportunidades do pipeline Qualificação (IA) marcadas como ganhas dentro do período, pela data em que foram marcadas como ganhas no GHL.',
  consultas_novas:
    'Oportunidades do pipeline Qualificação (IA) criadas no período que estão nas etapas Consulta Agendada e Pós consulta.',
  faturamento_consultas:
    'Cada agendamento criado no calendário do GHL vale R$ 160, e quando é marcado como comparecido passa a valer R$ 320 (no lugar dos 160, não somando). Independente do cartão Consultas agendadas, que conta pela etapa do pipeline. Clique no cartão para ver quais linhas formam o valor.',
  faturamento_tratamentos:
    'Soma do valor das oportunidades do pipeline Qualificação (IA) marcadas como ganhas dentro do período (as mesmas do cartão Vendas). Clique no cartão para ver quais oportunidades formam o valor.',
  faturamento_total: 'Faturamento em consultas mais faturamento em tratamentos.',
}

export const EXTRA_HELP = {
  tratamentosNovos:
    'Oportunidades marcadas como ganhas no período que estão nas etapas de consulta (Consulta Agendada ou Pós consulta): consulta feita e convertida em tratamento.',
  fechamentosConsulta:
    'Oportunidades do pipeline Qualificação (IA) marcadas como ganhas no período que estão na etapa Consulta Agendada.',
  fechamentosFollowup:
    'Oportunidades do pipeline Qualificação (IA) marcadas como ganhas no período que estão na etapa Pós consulta (follow up).',
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
    'Oportunidades ganhas na etapa Consulta Agendada divididas pelas oportunidades que estão nessa etapa. Mostra quantos dos que chegaram à consulta fecham venda logo ali.',
  conversaoPosConsulta:
    'Oportunidades ganhas na etapa Pós consulta divididas pelas oportunidades que estão nessa etapa. Mostra quantos dos que seguiram para o acompanhamento (follow up) fecham venda depois.',
} as const
