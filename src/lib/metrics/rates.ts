import type { Funnel, Rates } from './types'

// Denominador zero retorna null ("sem dados"), nunca 0%.
export function ratio(numerator: number, denominator: number): number | null {
  if (denominator === 0) return null
  return numerator / denominator
}

// Taxas "ideais": as mesmas fórmulas, calculadas sobre as metas do funil.
// Sem meta em uma das pontas, a taxa fica sem dados.
// Não há meta separada para "fechamentos em consulta" nem "em follow up" (só a meta geral de vendas),
// então o lado ideal usa vendas como aproximação de conversaoConsulta e não tem conversaoPosConsulta.
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
    conversaoConsulta: r(m.vendas, m.comparecimentos),
    conversaoPosConsulta: null,
  }
}

// Decisão de 27/10/2026: a taxa de conversão na consulta (e a nova, pós consulta) passam a usar os
// fechamentos por etapa (oportunidades ganhas na etapa Consulta Agendada ou Pós consulta), não mais o
// total de vendas, para medir especificamente quem fecha em cada etapa.
export function funnelRates(f: Funnel): Rates {
  return {
    qualificacao: ratio(f.leadsQualificados, f.leads),
    agendamento: ratio(f.consultasAgendadas, f.leadsQualificados),
    agendamentoLead: ratio(f.consultasAgendadas, f.leads),
    comparecimento: ratio(f.comparecimentos, f.consultasAgendadas),
    conversaoConsulta: ratio(f.fechamentosConsulta, f.comparecimentos),
    conversaoPosConsulta: ratio(f.fechamentosFollowup, f.comparecimentos),
  }
}
