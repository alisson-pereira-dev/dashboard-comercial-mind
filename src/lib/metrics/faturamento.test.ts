import { describe, expect, it } from 'vitest'
import { somaConsultas, valorDeConsulta } from './faturamento'

describe('valorDeConsulta', () => {
  it('sem tratamento, é o valor da oportunidade', () => {
    expect(valorDeConsulta({ valor: 160 })).toBe(160)
    expect(valorDeConsulta({ valor: 160, valor_tratamento: null })).toBe(160)
  })
  it('com tratamento fechado, desconta o valor do tratamento', () => {
    expect(valorDeConsulta({ valor: 5670, valor_tratamento: 5350 })).toBe(320)
  })
  it('aceita números em texto (como o banco devolve)', () => {
    expect(valorDeConsulta({ valor: '5670.00', valor_tratamento: '5350.00' })).toBe(320)
  })
  it('nunca fica negativo (tratamento maior que o valor da oportunidade)', () => {
    expect(valorDeConsulta({ valor: 100, valor_tratamento: 500 })).toBe(0)
  })
  it('valor vazio ou zero conta zero', () => {
    expect(valorDeConsulta({ valor: 0 })).toBe(0)
    expect(valorDeConsulta({ valor: '' })).toBe(0)
  })
})

describe('somaConsultas', () => {
  it('soma a parte de consulta de cada oportunidade', () => {
    expect(somaConsultas([{ valor: 160 }, { valor: 160 }, { valor: 5670, valor_tratamento: 5350 }])).toBe(640)
  })
  it('o total com o tratamento é o valor das oportunidades, sem contar em dobro', () => {
    const ops = [{ valor: 160 }, { valor: 5670, valor_tratamento: 5350 }]
    const tratamentos = 5350
    expect(somaConsultas(ops) + tratamentos).toBe(160 + 5670)
  })
  it('lista vazia soma zero', () => {
    expect(somaConsultas([])).toBe(0)
  })
})
