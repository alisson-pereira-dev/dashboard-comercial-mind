import type { MetricKey } from './types'

// Texto do "!" de cada número. Mantenha em sincronia com src/lib/dashboard/queries.ts.
export const METRIC_HELP: Record<MetricKey, string> = {
  leads: 'Contatos criados no GHL dentro do período.',
  leads_qualificados:
    'Oportunidades criadas no período com o campo TRAQ MQL marcado. Não entram pacientes do pipeline Clientes da base.',
  consultas_agendadas:
    'Agendamentos do calendário criados no período. Os cancelados não entram.',
  comparecimentos:
    'Agendamentos marcados como "compareceu" no calendário, criados dentro do período (data "criado em" do GHL).',
  vendas:
    'Oportunidades ganhas que foram criadas dentro do período (data "criado em" do GHL). Não entram pacientes do pipeline Clientes da base.',
  consultas_novas:
    'Quantidade de vendas do período de contatos sem data de início de tratamento no GHL.',
  faturamento_consultas:
    'Soma do valor das vendas do período que são consulta, ou seja, de contatos sem data de início de tratamento.',
  faturamento_tratamentos:
    'Soma do valor das vendas do período que são tratamento, ou seja, de contatos com data de início de tratamento preenchida.',
  faturamento_total: 'Soma do valor de todas as vendas ganhas criadas no período.',
}

export const EXTRA_HELP = {
  tratamentosNovos:
    'Quantidade de vendas do período de contatos com data de início de tratamento preenchida no GHL.',
  metaFaturamento:
    'Quanto do faturamento total já foi feito em relação à meta cadastrada para o período.',
  qualificacao: 'Leads qualificados divididos pelos leads. Mostra quantos leads viram MQL.',
  agendamento: 'Consultas agendadas divididas pelos leads. Mostra quantos leads chegam a marcar consulta.',
  comparecimento:
    'Comparecimentos divididos pelas consultas agendadas. Mostra quantas consultas marcadas acontecem.',
  conversaoConsulta:
    'Vendas divididas pelos comparecimentos. Mostra quantas consultas realizadas viram venda.',
} as const
