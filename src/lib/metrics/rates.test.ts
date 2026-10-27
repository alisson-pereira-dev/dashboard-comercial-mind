import { describe, expect, it } from 'vitest'
import { funnelRates, funnelRatesFromGoals, ratio } from './rates'

describe('funnelRatesFromGoals', () => {
  it('calcula as taxas ideais a partir das metas', () => {
    const r = funnelRatesFromGoals({
      leads: 150,
      leads_qualificados: 75,
      consultas_agendadas: 30,
      comparecimentos: 15,
      vendas: 3,
    })
    expect(r.qualificacao).toBe(0.5)
    expect(r.agendamento).toBe(0.4) // 30 / 75 qualificados
    expect(r.agendamentoLead).toBe(0.2) // 30 / 150 leads
    expect(r.comparecimento).toBe(0.5)
    expect(r.conversaoConsulta).toBe(0.2) // aproximação: vendas / comparecimentos (sem meta de fechamentos)
  })
  it('sem meta em uma ponta, a taxa fica sem dados', () => {
    const r = funnelRatesFromGoals({
      leads: 150,
      leads_qualificados: null,
      consultas_agendadas: 150,
      comparecimentos: 0,
      vendas: 150,
    })
    expect(r.qualificacao).toBeNull()
    expect(r.agendamento).toBeNull() // sem meta de qualificados
    expect(r.agendamentoLead).toBe(1)
    expect(r.conversaoConsulta).toBeNull()
  })
  it('não existe meta de fechamentos por etapa: conversaoPosConsulta sempre sem dados', () => {
    const r = funnelRatesFromGoals({
      leads: 150,
      leads_qualificados: 75,
      consultas_agendadas: 30,
      comparecimentos: 15,
      vendas: 3,
    })
    expect(r.conversaoPosConsulta).toBeNull()
  })
})

describe('agendamento: sobre os qualificados e sobre os leads', () => {
  const base = { leads: 130, leadsQualificados: 50, consultasAgendadas: 15, comparecimentos: 0, vendas: 0, fechamentosConsulta: 0, fechamentosFollowup: 0 }
  it('130 leads, 50 qualificados e 15 consultas dão 30% e 11,5%', () => {
    const r = funnelRates(base)
    expect(r.agendamento).toBeCloseTo(0.3, 5)
    expect(r.agendamentoLead).toBeCloseTo(15 / 130, 5)
    expect(Math.round((r.agendamentoLead ?? 0) * 1000) / 10).toBe(11.5)
  })
  it('sem qualificados, a taxa sobre os qualificados fica sem dados e a sobre os leads continua', () => {
    const r = funnelRates({ ...base, leads: 100, leadsQualificados: 0, consultasAgendadas: 2 })
    expect(r.agendamento).toBeNull()
    expect(r.agendamentoLead).toBe(0.02)
  })
})

describe('ratio', () => {
  it('divide normalmente', () => {
    expect(ratio(1, 4)).toBe(0.25)
  })
  it('retorna null quando o denominador é zero', () => {
    expect(ratio(5, 0)).toBeNull()
  })
  it('retorna 0 quando só o numerador é zero', () => {
    expect(ratio(0, 5)).toBe(0)
  })
})

describe('funnelRates', () => {
  it('calcula as taxas do funil, incluindo a conversão por etapa (não mais por vendas)', () => {
    const rates = funnelRates({
      leads: 100,
      leadsQualificados: 40,
      consultasAgendadas: 20,
      comparecimentos: 10,
      vendas: 9, // deliberadamente diferente de fechamentosConsulta + fechamentosFollowup
      fechamentosConsulta: 5,
      fechamentosFollowup: 3,
    })
    expect(rates.qualificacao).toBe(0.4)
    expect(rates.agendamento).toBe(0.5) // 20 / 40 qualificados
    expect(rates.agendamentoLead).toBe(0.2) // 20 / 100 leads
    expect(rates.comparecimento).toBe(0.5)
    expect(rates.conversaoConsulta).toBe(0.5) // 5 fechamentos em consulta / 10 comparecimentos
    expect(rates.conversaoPosConsulta).toBe(0.3) // 3 fechamentos em follow up / 10 comparecimentos
  })
  it('marca sem dados quando o funil está vazio', () => {
    const rates = funnelRates({
      leads: 0,
      leadsQualificados: 0,
      consultasAgendadas: 0,
      comparecimentos: 0,
      vendas: 0,
      fechamentosConsulta: 0,
      fechamentosFollowup: 0,
    })
    expect(Object.values(rates).every((v) => v === null)).toBe(true)
  })
  it('a conversão por etapa é independente do total de vendas: sem comparecimentos, fica sem dados mesmo com vendas', () => {
    const rates = funnelRates({
      leads: 10,
      leadsQualificados: 5,
      consultasAgendadas: 3,
      comparecimentos: 0,
      vendas: 2,
      fechamentosConsulta: 1,
      fechamentosFollowup: 1,
    })
    expect(rates.conversaoConsulta).toBeNull()
    expect(rates.conversaoPosConsulta).toBeNull()
  })
})
