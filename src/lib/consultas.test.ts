import { describe, expect, it } from 'vitest'
import { montarConsultas, type AgendamentoAgendado, type Comparecimento } from './consultas'
import { faturamentoConsultas } from './metrics/faturamento'

const V = { agendada: 160, comparecida: 320 }
const ag = (id: string, contato: string | null = id, criado = '2026-10-10T15:00:00Z'): AgendamentoAgendado => ({
  id,
  contato_id: contato,
  data_inicio: '2026-10-11T09:00:00Z',
  criado_em: criado,
})
const comp = (id: string, contato: string | null = id, atualizado = '2026-10-12T15:00:00Z'): Comparecimento => ({
  id,
  contato_id: contato,
  data_inicio: '2026-10-11T14:00:00Z',
  atualizado_em_ghl: atualizado,
})

describe('montarConsultas', () => {
  it('cada agendamento vale 160 e cada comparecimento acrescenta 160 (a consulta passa a valer 320)', () => {
    const r = montarConsultas([ag('a')], [comp('a')], new Map(), V)
    expect(r.consultas.map((c) => [c.tipo, c.valor])).toEqual([
      ['agendada', 160],
      ['compareceu', 160],
    ])
    expect(r.total).toBe(320)
  })

  it('a soma da lista é igual ao cartão (faturamentoConsultas) em qualquer mistura', () => {
    for (const [a, c] of [[0, 0], [3, 0], [2, 2], [4, 1], [0, 2], [1, 5]] as const) {
      const r = montarConsultas(
        Array.from({ length: a }, (_, i) => ag(`o${i}`)),
        Array.from({ length: c }, (_, i) => comp(`e${i}`)),
        new Map(),
        V,
      )
      expect(r.total).toBe(faturamentoConsultas(a, c, V))
    }
  })

  it('lista vazia: total zero', () => {
    expect(montarConsultas([], [], new Map(), V)).toEqual({ consultas: [], total: 0 })
  })

  it('mostra o nome do paciente, ou "Sem nome no GHL" quando não há', () => {
    const nomes = new Map<string, string | null>([['c1', ' Maria Souza '], ['c2', null]])
    const r = montarConsultas([ag('a', 'c1'), ag('b', 'c2'), ag('c', null)], [], nomes, V)
    expect(r.consultas.map((c) => c.paciente)).toEqual(['Maria Souza', 'Sem nome no GHL', 'Sem nome no GHL'])
  })

  it('ordena pela data que põe a linha no período e guarda a data da consulta nas duas', () => {
    const r = montarConsultas(
      [ag('b', 'b', '2026-10-20T10:00:00Z')],
      [comp('c', 'c', '2026-10-05T10:00:00Z')],
      new Map(),
      V,
    )
    expect(r.consultas.map((c) => c.id)).toEqual(['compareceu-c', 'agendada-b'])
    expect(r.consultas[0].consultaEm).toBe('2026-10-11T14:00:00Z')
    expect(r.consultas[1].consultaEm).toBe('2026-10-11T09:00:00Z')
  })

  it('um mesmo agendamento criado e comparecido no mesmo período gera as duas linhas', () => {
    const r = montarConsultas([ag('x')], [comp('x')], new Map(), V)
    expect(r.consultas.map((c) => c.id)).toEqual(['agendada-x', 'compareceu-x'])
    expect(r.total).toBe(320)
  })

  it('usa os valores informados', () => {
    const r = montarConsultas([ag('a')], [comp('a')], new Map(), { agendada: 100, comparecida: 250 })
    expect(r.total).toBe(250)
  })
})
