import { describe, expect, it } from 'vitest'
import { metaTratamentosNovos } from './tratamentos-novos'

describe('metaTratamentosNovos', () => {
  it('divide a meta de faturamento pelo preço médio por tratamento do período', () => {
    // preço médio = 17010 / 3 = 5670; meta de faturamento 30000 -> 30000 / 5670 ~= 5,29 -> 5
    expect(metaTratamentosNovos(30000, 17010, 3)).toBe(5)
  })

  it('arredonda para o inteiro mais próximo', () => {
    // preço médio = 1000 / 2 = 500; meta 2300 / 500 = 4,6 -> 5
    expect(metaTratamentosNovos(2300, 1000, 2)).toBe(5)
  })

  it('sem meta de em tratamentos cadastrada, não há meta', () => {
    expect(metaTratamentosNovos(null, 17010, 3)).toBeNull()
  })

  it('sem tratamentos realizados ainda, não dá para saber o preço médio', () => {
    expect(metaTratamentosNovos(30000, 0, 0)).toBeNull()
    expect(metaTratamentosNovos(30000, 17010, 0)).toBeNull()
  })

  it('sem faturamento realizado (caso degenerado), não há preço médio', () => {
    expect(metaTratamentosNovos(30000, 0, 3)).toBeNull()
  })
})
