import type { Funnel, Rates } from './types'

// Denominador zero retorna null ("sem dados"), nunca 0%.
export function ratio(numerator: number, denominator: number): number | null {
  if (denominator === 0) return null
  return numerator / denominator
}

// Taxas "ideais": as mesmas fórmulas, calculadas sobre as metas do funil.
// Sem meta em uma das pontas, a taxa fica sem dados.
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
    agendamento: r(m.consultas_agendadas, m.leads),
    comparecimento: r(m.comparecimentos, m.consultas_agendadas),
    conversaoConsulta: r(m.vendas, m.comparecimentos),
  }
}

export function funnelRates(f: Funnel): Rates {
  return {
    qualificacao: ratio(f.leadsQualificados, f.leads),
    agendamento: ratio(f.consultasAgendadas, f.leads),
    comparecimento: ratio(f.comparecimentos, f.consultasAgendadas),
    conversaoConsulta: ratio(f.vendas, f.comparecimentos),
  }
}
