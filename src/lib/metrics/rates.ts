import type { Funnel, Rates } from './types'

// Denominador zero retorna null ("sem dados"), nunca 0%.
export function ratio(numerator: number, denominator: number): number | null {
  if (denominator === 0) return null
  return numerator / denominator
}

// Taxas "ideais": as mesmas fórmulas, calculadas sobre as metas do funil.
// Sem meta em uma das pontas, a taxa fica sem dados.
// Não há meta de "fechamentos em consulta" nem de "oportunidades na etapa Pós consulta", só a meta geral
// de vendas e a de consultas agendadas: o lado ideal usa vendas ÷ consultas agendadas como aproximação de
// conversaoConsulta, e não tem conversaoPosConsulta (sem meta equivalente para a etapa seguinte).
export function funnelRatesFromGoals(m: {
  leads: number | null
  leads_qualificados: number | null
  consultas_agendadas: number | null
  comparecimentos: number | null
  vendas: number | null
}): Rates {
  const r = (n: number | null, d: number | null) => (n === null || d === null ? null : ratio(n, d))
  return {
    qualificacao: r(m.leads_qualificados, m.leads),
    agendamento: r(m.consultas_agendadas, m.leads_qualificados),
    agendamentoLead: r(m.consultas_agendadas, m.leads),
    comparecimento: r(m.comparecimentos, m.consultas_agendadas),
    conversaoConsulta: r(m.vendas, m.consultas_agendadas),
    conversaoPosConsulta: null,
  }
}

// Decisão de 27/10/2026 (2ª correção): as duas taxas de conversão por etapa deixam de ter base no
// comparecimento. Cada uma passa a dividir pelos leads que chegaram à PRÓPRIA etapa: de quantos chegaram a
// Consulta Agendada, quantos foram dados como ganho ali; de quantos chegaram a Pós consulta, quantos
// fecharam depois.
export function funnelRates(f: Funnel): Rates {
  return {
    qualificacao: ratio(f.leadsQualificados, f.leads),
    agendamento: ratio(f.consultasAgendadas, f.leadsQualificados),
    agendamentoLead: ratio(f.consultasAgendadas, f.leads),
    comparecimento: ratio(f.comparecimentos, f.consultasAgendadas),
    conversaoConsulta: ratio(f.fechamentosConsulta, f.consultasAgendadas),
    conversaoPosConsulta: ratio(f.fechamentosFollowup, f.posConsultaN),
  }
}
