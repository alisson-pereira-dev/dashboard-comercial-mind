import { describe, expect, it } from 'vitest'
import { currentMonthBR, parsePeriod, presetRange, todayBR } from './period'

describe('parsePeriod', () => {
  it('usa o mês informado e cobre o mês inteiro', () => {
    const p = parsePeriod({ mes: '2026-10' })
    expect(p.kind).toBe('mes')
    expect(p.de).toBe('2026-10-01')
    expect(p.ate).toBe('2026-10-31')
    expect(p.fromIso).toBe('2026-10-01T03:00:00.000Z')
    expect(p.toIso).toBe('2026-11-01T03:00:00.000Z')
    expect(p.metaPesos).toEqual([{ mes: '2026-10-01', fracao: 1 }])
  })

  it('trata fevereiro de ano bissexto', () => {
    expect(parsePeriod({ mes: '2028-02' }).ate).toBe('2028-02-29')
  })

  it('intervalo customizado pesa cada mês pela fração de dias dentro do período', () => {
    const p = parsePeriod({ de: '2026-09-16', ate: '2026-10-16' })
    expect(p.kind).toBe('custom')
    expect(p.metaPesos).toHaveLength(2)
    expect(p.metaPesos[0]).toEqual({ mes: '2026-09-01', fracao: 15 / 30 })
    expect(p.metaPesos[1]).toEqual({ mes: '2026-10-01', fracao: 16 / 31 })
  })

  it('meses inteiros dentro de um intervalo pesam 1', () => {
    const p = parsePeriod({ de: '2026-09-15', ate: '2026-11-30' })
    expect(p.metaPesos.map((x) => x.fracao)).toEqual([16 / 30, 1, 1])
  })

  it('cai no mês atual quando os parâmetros são inválidos', () => {
    const now = new Date('2026-10-16T12:00:00Z')
    expect(parsePeriod({ mes: 'abc' }, now).de).toBe('2026-10-01')
    expect(parsePeriod({ de: '2026-10-20', ate: '2026-10-01' }, now).kind).toBe('mes')
    expect(parsePeriod({ de: '2026-02-31', ate: '2026-03-10' }, now).kind).toBe('mes')
  })
})

describe('datas no fuso de Brasília', () => {
  it('usa o fuso de Brasília na virada do dia e do mês', () => {
    expect(todayBR(new Date('2026-11-01T01:00:00Z'))).toBe('2026-10-31')
    expect(currentMonthBR(new Date('2026-11-01T01:00:00Z'))).toBe('2026-10')
    expect(currentMonthBR(new Date('2026-11-01T04:00:00Z'))).toBe('2026-11')
  })
})

describe('presetRange', () => {
  const hoje = '2026-10-16'
  it('mês atual e mês anterior', () => {
    expect(presetRange('mes_atual', hoje)).toEqual({ de: '2026-10-01', ate: '2026-10-31' })
    expect(presetRange('mes_anterior', hoje)).toEqual({ de: '2026-09-01', ate: '2026-09-30' })
    expect(presetRange('mes_anterior', '2026-01-10')).toEqual({ de: '2025-12-01', ate: '2025-12-31' })
  })
  it('últimos 7 e 30 dias incluem hoje', () => {
    expect(presetRange('ultimos_7', hoje)).toEqual({ de: '2026-10-10', ate: hoje })
    expect(presetRange('ultimos_30', hoje)).toEqual({ de: '2026-09-17', ate: hoje })
  })
})
