import { describe, expect, it } from 'vitest'
import { applyOrder, sameOrder } from './order'

describe('applyOrder', () => {
  const base = ['a', 'b', 'c']

  it('usa a ordem salva', () => {
    expect(applyOrder(base, ['c', 'a', 'b'])).toEqual(['c', 'a', 'b'])
  })
  it('ignora ids salvos que não existem mais', () => {
    expect(applyOrder(base, ['x', 'c', 'a'])).toEqual(['c', 'a', 'b'])
  })
  it('coloca ids novos no fim', () => {
    expect(applyOrder(['a', 'b', 'c', 'd'], ['c', 'a'])).toEqual(['c', 'a', 'b', 'd'])
  })
  it('remove repetidos', () => {
    expect(applyOrder(base, ['b', 'b', 'a'])).toEqual(['b', 'a', 'c'])
  })
  it('volta ao padrão quando o valor salvo é inválido', () => {
    expect(applyOrder(base, null)).toEqual(base)
    expect(applyOrder(base, 'texto')).toEqual(base)
    expect(applyOrder(base, [1, 2])).toEqual(base)
  })
})

describe('sameOrder', () => {
  it('compara posição por posição', () => {
    expect(sameOrder(['a', 'b'], ['a', 'b'])).toBe(true)
    expect(sameOrder(['a', 'b'], ['b', 'a'])).toBe(false)
    expect(sameOrder(['a'], ['a', 'b'])).toBe(false)
  })
})
