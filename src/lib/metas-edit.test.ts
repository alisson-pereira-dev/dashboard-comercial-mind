import { describe, expect, it } from 'vitest'
import { METRIC_KEYS } from './metrics/types'
import {
  agendamentoSobreLeads,
  editar,
  modoInicial,
  precoConsultaDe,
  precoTratamentoDe,
  taxasDe,
  TAXAS_VAZIAS,
  type Estado,
  type Valores,
} from './metas-edit'

const vazio = Object.fromEntries(METRIC_KEYS.map((k) => [k, ''])) as Valores

const base: Valores = {
  ...vazio,
  leads: '100',
  leads_qualificados: '40',
  consultas_agendadas: '20',
  comparecimentos: '10',
  vendas: '5',
}
const estado = (): Estado => ({
  valores: { ...base },
  taxas: taxasDe(base),
  precoConsulta: precoConsultaDe(base),
  precoTratamento: precoTratamentoDe(base),
})

describe('taxasDe', () => {
  it('calcula a taxa implícita nos valores', () => {
    expect(taxasDe(base)).toEqual({ qualificacao: '40', agendamento: '50', comparecimento: '50', conversao: '50' })
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
    expect(r.taxas.agendamento).toBe('75') // 30 / 40 qualificados
    expect(r.valores.comparecimentos).toBe('15') // 30 x 50%
    expect(r.valores.vendas).toBe('8') // 15 x 50%, arredondado
    expect(r.valores.leads).toBe('100') // nunca recalcula para trás
  })

  it('editar os qualificados ajusta a taxa de qualificação e recalcula as consultas pela taxa de agendamento', () => {
    const r = editar(estado(), { tipo: 'valor', chave: 'leads_qualificados' }, '60')
    expect(r.taxas.qualificacao).toBe('60')
    expect(r.valores.consultas_agendadas).toBe('30') // 60 x 50%
    expect(r.valores.leads).toBe('100')
  })

  it('editar uma etapa sem dependentes só ajusta a própria taxa', () => {
    const r = editar(estado(), { tipo: 'valor', chave: 'vendas' }, '4')
    expect(r.taxas.conversao).toBe('40')
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
    const r = editar(estado(), { tipo: 'taxa', chave: 'agendamento' }, '75')
    expect(r.valores.consultas_agendadas).toBe('30') // 40 qualificados x 75%
    expect(r.valores.comparecimentos).toBe('15')
    expect(r.valores.vendas).toBe('8') // 7,5 arredonda para 8
    expect(r.valores.leads_qualificados).toBe('40') // taxa de qualificação não muda
  })

  it('taxa sem base preenchida só guarda o texto', () => {
    const r = editar({ valores: { ...vazio }, taxas: { ...TAXAS_VAZIAS }, precoConsulta: null, precoTratamento: null }, { tipo: 'taxa', chave: 'qualificacao' }, '30')
    expect(r.taxas.qualificacao).toBe('30')
    expect(r.valores.leads_qualificados).toBe('')
    expect(r.auto).toEqual([])
  })

  it('preencher só os leads e as taxas monta o funil inteiro', () => {
    let e: Estado = { valores: { ...vazio }, taxas: { ...TAXAS_VAZIAS }, precoConsulta: null, precoTratamento: null }
    for (const [chave, texto] of [['qualificacao', '40'], ['agendamento', '50'], ['comparecimento', '50'], ['conversao', '50']] as const) {
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

  it('quantidade ainda em branco: o valor de em consultas digitado vira o valor por consulta', () => {
    // Mesmo cenário do card: Em consultas = 480 com Consultas novas em branco (mostra "0" de
    // placeholder). Trocar a quantidade deve multiplicar esse 480 na hora, pra mais ou pra menos.
    let e: ReturnType<typeof editar> = { ...estado(), auto: [] }
    e = editar(e, { tipo: 'valor', chave: 'faturamento_consultas' }, '480')
    e = editar(e, { tipo: 'valor', chave: 'consultas_novas' }, '10')
    expect(e.valores.faturamento_consultas).toBe('4800') // 480 x 10
    expect(e.valores.faturamento_total).toBe('4800')
    expect(e.auto).toContain('faturamento_consultas')
    expect(e.auto).toContain('faturamento_total')
  })

  it('com quantidade já definida, trocar consultas novas mantém o valor por consulta (pra mais ou pra menos)', () => {
    let e: ReturnType<typeof editar> = { ...estado(), auto: [] }
    e = editar(e, { tipo: 'valor', chave: 'faturamento_consultas' }, '480')
    e = editar(e, { tipo: 'valor', chave: 'consultas_novas' }, '10') // vira 4800 (480 x 10)
    e = editar(e, { tipo: 'valor', chave: 'consultas_novas' }, '15')
    expect(e.valores.faturamento_consultas).toBe('7200') // 4800 / 10 x 15 = 480 x 15
    e = editar(e, { tipo: 'valor', chave: 'consultas_novas' }, '4')
    expect(e.valores.faturamento_consultas).toBe('1920') // 480 x 4, também funciona pra menos
  })

  it('sem preço anterior em consultas, mudar consultas novas não cria um valor', () => {
    let e: ReturnType<typeof editar> = { ...estado(), auto: [] }
    e = editar(e, { tipo: 'valor', chave: 'consultas_novas' }, '15')
    e = editar(e, { tipo: 'valor', chave: 'consultas_novas' }, '20')
    expect(e.valores.faturamento_consultas).toBe('')
  })

  it('consultas novas em branco não mexe em em consultas', () => {
    let e: ReturnType<typeof editar> = { ...estado(), auto: [] }
    e = editar(e, { tipo: 'valor', chave: 'faturamento_consultas' }, '480')
    e = editar(e, { tipo: 'valor', chave: 'consultas_novas' }, '10')
    e = editar(e, { tipo: 'valor', chave: 'consultas_novas' }, '')
    expect(e.valores.faturamento_consultas).toBe('4800')
  })

  it('apagar consultas novas e digitar de novo mantém o valor por consulta certo (não dobra)', () => {
    // Regressão: apagar o campo para digitar de novo não pode fazer o sistema achar que o total já
    // calculado (4800) é o novo valor por consulta na próxima digitação.
    let e: ReturnType<typeof editar> = { ...estado(), auto: [] }
    e = editar(e, { tipo: 'valor', chave: 'faturamento_consultas' }, '480')
    e = editar(e, { tipo: 'valor', chave: 'consultas_novas' }, '10') // vira 4800 (480 x 10)
    e = editar(e, { tipo: 'valor', chave: 'consultas_novas' }, '') // apaga para digitar de novo
    e = editar(e, { tipo: 'valor', chave: 'consultas_novas' }, '4')
    expect(e.valores.faturamento_consultas).toBe('1920') // 480 x 4, não 4800 x 4
  })

  it('editar em consultas direto muda o valor por consulta usado depois', () => {
    let e: ReturnType<typeof editar> = { ...estado(), auto: [] }
    e = editar(e, { tipo: 'valor', chave: 'faturamento_consultas' }, '480')
    e = editar(e, { tipo: 'valor', chave: 'consultas_novas' }, '10') // vira 4800, 480 por consulta
    e = editar(e, { tipo: 'valor', chave: 'faturamento_consultas' }, '3000') // agora 300 por consulta
    e = editar(e, { tipo: 'valor', chave: 'consultas_novas' }, '5')
    expect(e.valores.faturamento_consultas).toBe('1500') // 300 x 5
  })

  // Mesmo mecanismo de Em consultas / Consultas novas, agora para Em tratamentos / Tratamentos novos.
  it('tratamentos novos recalcula em tratamentos do mesmo jeito que consultas novas recalcula em consultas', () => {
    let e: ReturnType<typeof editar> = { ...estado(), auto: [] }
    e = editar(e, { tipo: 'valor', chave: 'faturamento_tratamentos' }, '2000')
    e = editar(e, { tipo: 'valor', chave: 'tratamentos_novos' }, '4')
    expect(e.valores.faturamento_tratamentos).toBe('8000') // 2000 x 4
    expect(e.auto).toContain('faturamento_tratamentos')
    e = editar(e, { tipo: 'valor', chave: 'tratamentos_novos' }, '') // apaga para digitar de novo
    e = editar(e, { tipo: 'valor', chave: 'tratamentos_novos' }, '2')
    expect(e.valores.faturamento_tratamentos).toBe('4000') // 2000 x 2, não 8000 x 2 (não dobra)
  })

  it('consultas novas e tratamentos novos não se misturam', () => {
    let e: ReturnType<typeof editar> = { ...estado(), auto: [] }
    e = editar(e, { tipo: 'valor', chave: 'faturamento_consultas' }, '480')
    e = editar(e, { tipo: 'valor', chave: 'faturamento_tratamentos' }, '2000')
    e = editar(e, { tipo: 'valor', chave: 'consultas_novas' }, '10')
    e = editar(e, { tipo: 'valor', chave: 'tratamentos_novos' }, '3')
    expect(e.valores.faturamento_consultas).toBe('4800') // 480 x 10
    expect(e.valores.faturamento_tratamentos).toBe('6000') // 2000 x 3
    expect(e.valores.faturamento_total).toBe('10800')
  })
})

describe('modo manual', () => {
  it('editar uma etapa não recalcula as outras, só as taxas exibidas', () => {
    const r = editar(estado(), { tipo: 'valor', chave: 'leads' }, '200', 'manual')
    expect(r.valores).toMatchObject({ leads: '200', leads_qualificados: '40', consultas_agendadas: '20', comparecimentos: '10', vendas: '5' })
    expect(r.taxas.qualificacao).toBe('20') // 40 / 200
    expect(r.taxas.agendamento).toBe('50') // 20 / 40 qualificados
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

describe('agendamentoSobreLeads', () => {
  it('é consultas agendadas sobre os leads totais', () => {
    expect(agendamentoSobreLeads({ ...vazio, leads: '130', consultas_agendadas: '15' })).toBe('11.54')
    expect(agendamentoSobreLeads(base)).toBe('20')
  })
  it('fica vazio sem leads ou sem consultas', () => {
    expect(agendamentoSobreLeads(vazio)).toBe('')
    expect(agendamentoSobreLeads({ ...vazio, leads: '0', consultas_agendadas: '5' })).toBe('')
    expect(agendamentoSobreLeads({ ...vazio, leads: '100' })).toBe('')
  })
  it('não é uma das taxas que calculam as etapas', () => {
    const r = editar(estado(), { tipo: 'valor', chave: 'leads' }, '200')
    expect(Object.keys(r.taxas)).not.toContain('agendamentoLead')
    expect(agendamentoSobreLeads(r.valores)).toBe('20') // 40 / 200
  })
})
