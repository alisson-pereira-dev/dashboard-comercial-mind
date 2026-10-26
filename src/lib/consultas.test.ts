import { describe, expect, it } from 'vitest'
import { montarConsultas, type AgendamentoRow } from './consultas'
import { faturamentoConsultas } from './metrics/faturamento'

const V = { agendada: 160, comparecida: 320 }
const ag = (id: string, status: string, contato: string | null = id, inicio = '2026-10-10T15:00:00Z'): AgendamentoRow => ({
  id,
  contato_id: contato,
  data_inicio: inicio,
  criado_em: '2026-10-01T12:00:00Z',
  status,
})

describe('montarConsultas', () => {
  it('cada consulta agendada vale 160 e a comparecida vale 320 (no lugar dos 160)', () => {
    const r = montarConsultas([ag('a', 'agendado'), ag('b', 'compareceu')], new Map(), V)
    expect(r.consultas.map((c) => c.valor)).toEqual([160, 320])
    expect(r.total).toBe(480)
  })

  it('a soma da lista é igual ao cartão (faturamentoConsultas) em qualquer mistura', () => {
    const rows = [
      ag('1', 'agendado'),
      ag('2', 'agendado'),
      ag('3', 'compareceu'),
      ag('4', 'compareceu'),
      ag('5', 'nao_compareceu'),
      ag('6', 'cancelado'),
    ]
    const r = montarConsultas(rows, new Map(), V)
    const agendadas = rows.filter((x) => x.status !== 'cancelado').length // como o cartão conta
    const comparecidas = rows.filter((x) => x.status === 'compareceu').length
    expect(r.total).toBe(faturamentoConsultas(agendadas, comparecidas, V))
    expect(r.consultas).toHaveLength(5)
  })

  it('consulta cancelada não aparece nem soma', () => {
    const r = montarConsultas([ag('a', 'cancelado')], new Map(), V)
    expect(r.consultas).toEqual([])
    expect(r.total).toBe(0)
  })

  it('quem faltou continua valendo 160 (foi agendada)', () => {
    const r = montarConsultas([ag('a', 'nao_compareceu')], new Map(), V)
    expect(r.consultas[0]).toMatchObject({ status: 'nao_compareceu', valor: 160 })
  })

  it('mostra o nome do paciente, ou "Sem nome no GHL" quando não há', () => {
    const nomes = new Map<string, string | null>([['c1', ' Maria Souza '], ['c2', null]])
    const r = montarConsultas([ag('a', 'agendado', 'c1'), ag('b', 'agendado', 'c2'), ag('c', 'agendado', null)], nomes, V)
    expect(r.consultas.map((c) => c.paciente)).toEqual(['Maria Souza', 'Sem nome no GHL', 'Sem nome no GHL'])
  })

  it('ordena pela data da consulta', () => {
    const r = montarConsultas(
      [ag('b', 'agendado', 'b', '2026-10-20T10:00:00Z'), ag('a', 'agendado', 'a', '2026-10-05T10:00:00Z')],
      new Map(),
      V,
    )
    expect(r.consultas.map((c) => c.id)).toEqual(['a', 'b'])
  })

  it('usa os valores informados', () => {
    const r = montarConsultas([ag('a', 'agendado'), ag('b', 'compareceu')], new Map(), { agendada: 100, comparecida: 250 })
    expect(r.total).toBe(350)
  })
})
