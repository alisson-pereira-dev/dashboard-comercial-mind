import { describe, expect, it } from 'vitest'
import { faturamentoConsultas } from './faturamento'

const V = { agendada: 160, comparecida: 320 }

describe('faturamentoConsultas', () => {
  it('cada consulta agendada soma 160', () => {
    expect(faturamentoConsultas(1, 0, V)).toBe(160)
    expect(faturamentoConsultas(10, 0, V)).toBe(1600)
  })
  it('a consulta comparecida passa a valer 320, no lugar dos 160 (não soma)', () => {
    expect(faturamentoConsultas(1, 1, V)).toBe(320)
  })
  it('a fórmula do pedido: (agendadas não comparecidas x 160) + (comparecidas x 320)', () => {
    // 10 agendadas, 4 delas comparecidas: 6 x 160 + 4 x 320
    expect(faturamentoConsultas(10, 4, V)).toBe(6 * 160 + 4 * 320)
    expect(faturamentoConsultas(10, 4, V)).toBe(2240)
  })
  it('equivale a agendadas x 160 mais comparecidas x 160', () => {
    expect(faturamentoConsultas(10, 4, V)).toBe(10 * 160 + 4 * 160)
  })
  it('sem consultas, zero', () => {
    expect(faturamentoConsultas(0, 0, V)).toBe(0)
  })
  it('comparecidas podem passar das agendadas (fontes e datas diferentes) e a fórmula segue valendo', () => {
    // 0 agendadas na etapa, 1 comparecida: (0 - 1) x 160 + 1 x 320 = 160
    expect(faturamentoConsultas(0, 1, V)).toBe(160)
    expect(faturamentoConsultas(2, 5, V)).toBe(2 * 160 + 5 * 160)
  })
  it('valores negativos ou lixo não geram faturamento negativo', () => {
    expect(faturamentoConsultas(-3, 0, V)).toBe(0)
    expect(faturamentoConsultas(3, -2, V)).toBe(3 * 160)
  })
  it('usa os valores informados', () => {
    expect(faturamentoConsultas(2, 1, { agendada: 100, comparecida: 250 })).toBe(100 + 250)
  })
})
