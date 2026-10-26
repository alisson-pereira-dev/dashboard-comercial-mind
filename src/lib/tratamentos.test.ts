import { describe, expect, it } from 'vitest'
import { montarTratamentos, type OportunidadeRow } from './tratamentos'

const opp = (id: string, contato: string | null, valor: number | string | null, criado: string): OportunidadeRow => ({
  id,
  contato_id: contato,
  valor,
  criado_em: criado,
  fechado_em: null,
})

describe('montarTratamentos', () => {
  const nomes = new Map<string, string | null>([
    ['c1', ' Ana Souza '],
    ['c2', null],
  ])

  it('soma os valores, igual ao cartão Em tratamentos', () => {
    const r = montarTratamentos(
      [opp('a', 'c1', 5670, '2026-09-02T10:00:00Z'), opp('b', 'c1', '5670.00', '2026-09-05T10:00:00Z')],
      nomes,
    )
    expect(r.total).toBe(11340)
    expect(r.tratamentos).toHaveLength(2)
  })

  it('usa o nome sem espaços e um aviso quando o nome falta', () => {
    const r = montarTratamentos(
      [opp('a', 'c1', 100, '2026-09-02T10:00:00Z'), opp('b', 'c2', 100, '2026-09-03T10:00:00Z'), opp('c', null, 100, '2026-09-04T10:00:00Z')],
      nomes,
    )
    expect(r.tratamentos.map((t) => t.paciente)).toEqual(['Ana Souza', 'Sem nome no GHL', 'Sem nome no GHL'])
  })

  it('ordena pela data de criação e trata valor vazio como zero', () => {
    const r = montarTratamentos(
      [opp('b', 'c1', null, '2026-09-10T10:00:00Z'), opp('a', 'c1', 50, '2026-09-01T10:00:00Z')],
      nomes,
    )
    expect(r.tratamentos.map((t) => t.id)).toEqual(['a', 'b'])
    expect(r.total).toBe(50)
  })

  it('lista vazia dá total zero', () => {
    expect(montarTratamentos([], nomes)).toEqual({ tratamentos: [], total: 0 })
  })
})
