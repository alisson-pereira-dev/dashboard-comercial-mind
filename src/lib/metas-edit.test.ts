import { describe, expect, it } from 'vitest'
import { METRIC_KEYS } from './metrics/types'
import { editar, modoInicial, taxasDe, TAXAS_VAZIAS, type Estado, type Valores } from './metas-edit'

const vazio = Object.fromEntries(METRIC_KEYS.map((k) => [k, ''])) as Valores

const base: Valores = {
  ...vazio,
  leads: '100',
  leads_qualificados: '40',
  consultas_agendadas: '20',
  comparecimentos: '10',
  vendas: '5',
}
const estado = (): Estado => ({ valores: { ...base }, taxas: taxasDe(base) })

describe('taxasDe', () => {
  it('calcula a taxa implícita nos valores', () => {
    expect(taxasDe(base)).toEqual({ qualificacao: '40', agendamento: '20', comparecimento: '50', conversao: '50' })
  })
  it('deixa vazio quando falta a base ou o valor', () => {
    expect(taxasDe(vazio)).toEqual(TAXAS_VAZIAS)
    expect(taxasDe({ ...base, leads: '0' }).qualificacao).toBe('')
    expect(taxasDe({ ...base, leads_qualificados: '' }).qualificacao).toBe('')
  })
})

describe('editar: valores do funil', () => {
  it('editar os leads recalcula todas as etapas pelas taxas atuais', () => {
    const r = editar(estado(), { tipo: 'valor', chave: 'leads' }, '200')
    expect(r.valores).toMatchObject({
      leads: '200',
      leads_qualificados: '80',
      consultas_agendadas: '40',
      comparecimentos: '20',
      vendas: '10',
    })
    expect(r.auto.sort()).toEqual(['comparecimentos', 'consultas_agendadas', 'leads_qualificados', 'vendas'].sort())
    expect(r.auto).not.toContain('leads')
  })

  it('editar uma etapa ajusta a taxa que leva até ela e recalcula as seguintes', () => {
    const r = editar(estado(), { tipo: 'valor', chave: 'consultas_agendadas' }, '30')
    expect(r.taxas.agendamento).toBe('30')
    expect(r.valores.comparecimentos).toBe('15') // 30 x 50%
    expect(r.valores.vendas).toBe('8') // 15 x 50%, arredondado
    expect(r.valores.leads).toBe('100') // nunca recalcula para trás
  })

  it('editar uma etapa sem dependentes só ajusta a própria taxa', () => {
    const r = editar(estado(), { tipo: 'valor', chave: 'leads_qualificados' }, '60')
    expect(r.taxas.qualificacao).toBe('60')
    expect(r.auto).toEqual([])
  })

  it('valor em branco não dispara cálculo e mantém a taxa', () => {
    const r = editar(estado(), { tipo: 'valor', chave: 'leads' }, '')
    expect(r.valores.leads_qualificados).toBe('40')
    expect(r.taxas.qualificacao).toBe('40')
  })

  it('texto inválido ou negativo não dispara cálculo', () => {
    const r = editar(estado(), { tipo: 'valor', chave: 'leads' }, '-5')
    expect(r.valores.leads_qualificados).toBe('40')
  })
})

describe('editar: taxas', () => {
  it('editar uma taxa recalcula a etapa seguinte e as que dependem dela', () => {
    const r = editar(estado(), { tipo: 'taxa', chave: 'agendamento' }, '50')
    expect(r.valores.consultas_agendadas).toBe('50')
    expect(r.valores.comparecimentos).toBe('25')
    expect(r.valores.vendas).toBe('13') // 12,5 arredonda para 13
    expect(r.valores.leads_qualificados).toBe('40') // taxa de qualificação não muda
  })

  it('taxa sem base preenchida só guarda o texto', () => {
    const r = editar({ valores: { ...vazio }, taxas: { ...TAXAS_VAZIAS } }, { tipo: 'taxa', chave: 'qualificacao' }, '30')
    expect(r.taxas.qualificacao).toBe('30')
    expect(r.valores.leads_qualificados).toBe('')
    expect(r.auto).toEqual([])
  })

  it('preencher só os leads e as taxas monta o funil inteiro', () => {
    let e: Estado = { valores: { ...vazio }, taxas: { ...TAXAS_VAZIAS } }
    for (const [chave, texto] of [['qualificacao', '40'], ['agendamento', '20'], ['comparecimento', '50'], ['conversao', '50']] as const) {
      e = editar(e, { tipo: 'taxa', chave }, texto)
    }
    e = editar(e, { tipo: 'valor', chave: 'leads' }, '150')
    expect(e.valores).toMatchObject({ leads: '150', leads_qualificados: '60', consultas_agendadas: '30', comparecimentos: '15', vendas: '8' })
  })
})

describe('editar: faturamento', () => {
  it('o total vira a soma de consultas e tratamentos', () => {
    let e: ReturnType<typeof editar> = { ...estado(), auto: [] }
    e = editar(e, { tipo: 'valor', chave: 'faturamento_consultas' }, '30000')
    expect(e.valores.faturamento_total).toBe('30000')
    e = editar(e, { tipo: 'valor', chave: 'faturamento_tratamentos' }, '80000.5')
    expect(e.valores.faturamento_total).toBe('110000.5')
    expect(e.auto).toContain('faturamento_total')
  })
  it('editar o total à mão não mexe nas partes', () => {
    let e = estado()
    e = editar(e, { tipo: 'valor', chave: 'faturamento_consultas' }, '100')
    e = editar(e, { tipo: 'valor', chave: 'faturamento_total' }, '999')
    expect(e.valores.faturamento_total).toBe('999')
    expect(e.valores.faturamento_consultas).toBe('100')
  })
  it('limpar as duas partes limpa o total', () => {
    let e = estado()
    e = editar(e, { tipo: 'valor', chave: 'faturamento_consultas' }, '100')
    e = editar(e, { tipo: 'valor', chave: 'faturamento_consultas' }, '')
    expect(e.valores.faturamento_total).toBe('')
  })
})

describe('modo manual', () => {
  it('editar uma etapa não recalcula as outras, só as taxas exibidas', () => {
    const r = editar(estado(), { tipo: 'valor', chave: 'leads' }, '200', 'manual')
    expect(r.valores).toMatchObject({ leads: '200', leads_qualificados: '40', consultas_agendadas: '20', comparecimentos: '10', vendas: '5' })
    expect(r.taxas.qualificacao).toBe('20') // 40 / 200
    expect(r.taxas.agendamento).toBe('10')
    expect(r.auto).toEqual([])
  })
  it('o total do faturamento continua sendo a soma', () => {
    const r = editar(estado(), { tipo: 'valor', chave: 'faturamento_consultas' }, '500', 'manual')
    expect(r.valores.faturamento_total).toBe('500')
  })
})

describe('modoInicial', () => {
  it('abre em manual quando já há metas do funil', () => {
    expect(modoInicial(base)).toBe('manual')
  })
  it('abre em automático quando o funil está vazio', () => {
    expect(modoInicial(vazio)).toBe('automatico')
    expect(modoInicial({ ...vazio, faturamento_total: '100' })).toBe('automatico')
  })
})
