import { describe, expect, it } from 'vitest'
import {
  isMql,
  mapUser,
  resolveOwner,
  mapAppointmentStatus,
  mapContact,
  mapEvent,
  mapOpportunity,
  mapOpportunityStatus,
  parseGhlDate,
  valorTratamento,
} from './mappers'
import { GHL_FIELD_INICIO_TRATAMENTO_ID, GHL_FIELD_MQL_ID, GHL_FIELD_VALOR_TRATAMENTO_ID } from './config'

describe('parseGhlDate', () => {
  it('lê ISO, milissegundos e texto numérico', () => {
    expect(parseGhlDate('2026-10-01T10:00:00.000Z')?.toISOString()).toBe('2026-10-01T10:00:00.000Z')
    expect(parseGhlDate(1792116099200)?.getTime()).toBe(1792116099200)
    expect(parseGhlDate('1792116099200')?.getTime()).toBe(1792116099200)
  })
  it('devolve null para vazio ou inválido', () => {
    expect(parseGhlDate(null)).toBeNull()
    expect(parseGhlDate('')).toBeNull()
    expect(parseGhlDate('nao-e-data')).toBeNull()
  })
})

describe('status', () => {
  it('mapeia status de oportunidade', () => {
    expect(mapOpportunityStatus('won')).toBe('ganha')
    expect(mapOpportunityStatus('lost')).toBe('perdida')
    expect(mapOpportunityStatus('abandoned')).toBe('perdida')
    expect(mapOpportunityStatus('open')).toBe('aberta')
  })
  it('mapeia status de agendamento', () => {
    expect(mapAppointmentStatus('showed')).toBe('compareceu')
    expect(mapAppointmentStatus('noshow')).toBe('nao_compareceu')
    expect(mapAppointmentStatus('cancelled')).toBe('cancelado')
    expect(mapAppointmentStatus('confirmed')).toBe('agendado')
    expect(mapAppointmentStatus('new')).toBe('agendado')
  })
})

describe('mapContact', () => {
  it('lê a data de início de tratamento do campo personalizado', () => {
    const row = mapContact({
      id: 'c1',
      contactName: 'Fulana',
      dateAdded: '2026-10-01T10:00:00.000Z',
      customFields: [{ id: GHL_FIELD_INICIO_TRATAMENTO_ID, value: '2026-10-05T12:00:00.000Z' }],
    })
    expect(row?.data_inicio_tratamento).toBe('2026-10-05')
  })
  it('ignora contato sem id ou sem data de criação', () => {
    expect(mapContact({ dateAdded: '2026-10-01T10:00:00.000Z' })).toBeNull()
    expect(mapContact({ id: 'c1' })).toBeNull()
  })
})

describe('isMql', () => {
  it('reconhece o checkbox marcado', () => {
    expect(isMql({ customFields: [{ id: GHL_FIELD_MQL_ID, fieldValueArray: ['MQL'] }] })).toBe(true)
  })
  it('não marca quando o campo falta ou está vazio', () => {
    expect(isMql({ customFields: [] })).toBe(false)
    expect(isMql({ customFields: [{ id: GHL_FIELD_MQL_ID, fieldValueArray: [] }] })).toBe(false)
    expect(isMql({})).toBe(false)
  })
})

describe('mapOpportunity', () => {
  const ctx = {
    pipelineNames: new Map([['p1', 'Qualificação ( IA )']]),
    contatosComTratamento: new Set(['c-trat']),
  }
  const base = {
    id: 'o1',
    contactId: 'c1',
    pipelineId: 'p1',
    status: 'won',
    monetaryValue: 1500,
    createdAt: '2026-10-01T10:00:00.000Z',
    lastStatusChangeAt: '2026-10-10T10:00:00.000Z',
    lastStageChangeAt: '2026-10-05T10:00:00.000Z',
  }
  it('mapeia venda ganha como consulta quando o contato não tem início de tratamento', () => {
    const row = mapOpportunity(base, ctx)
    expect(row).toMatchObject({
      tipo: 'consulta',
      status: 'ganha',
      valor: 1500,
      pipeline_nome: 'Qualificação ( IA )',
      fechado_em: '2026-10-10T10:00:00.000Z',
      etapa_alterada_em: '2026-10-05T10:00:00.000Z',
    })
  })
  it('etapa_alterada_em vem da última mudança de etapa e fica vazia quando o GHL não informa', () => {
    expect(mapOpportunity({ ...base, lastStageChangeAt: undefined }, ctx)?.etapa_alterada_em).toBeNull()
  })
  it('mapeia como tratamento quando o contato tem início de tratamento', () => {
    expect(mapOpportunity({ ...base, contactId: 'c-trat' }, ctx)?.tipo).toBe('tratamento')
  })
  it('oportunidade aberta não tem data de fechamento', () => {
    expect(mapOpportunity({ ...base, status: 'open' }, ctx)?.fechado_em).toBeNull()
  })
})

describe('mapEvent', () => {
  it('mapeia evento e ignora os apagados', () => {
    const raw = {
      id: 'e1',
      contactId: 'c1',
      startTime: '2026-10-05T13:00:00.000Z',
      dateAdded: '2026-10-01T10:00:00.000Z',
      appointmentStatus: 'noshow',
    }
    expect(mapEvent(raw)?.status).toBe('nao_compareceu')
    expect(mapEvent({ ...raw, deleted: true })).toBeNull()
  })
})

describe('resolveOwner', () => {
  it('mantém o responsável do GHL', () => {
    expect(resolveOwner('u1', 'padrao')).toEqual({ responsavel_id: 'u1', responsavel_padrao: false })
  })
  it('sem responsável, usa o vendedor padrão e marca como padrão', () => {
    expect(resolveOwner(undefined, 'padrao')).toEqual({ responsavel_id: 'padrao', responsavel_padrao: true })
    expect(resolveOwner('', 'padrao')).toEqual({ responsavel_id: 'padrao', responsavel_padrao: true })
  })
  it('sem responsável e sem vendedor padrão, fica sem dono', () => {
    expect(resolveOwner(null, null)).toEqual({ responsavel_id: null, responsavel_padrao: false })
  })
})

describe('mapUser', () => {
  it('marca vendedores pela lista de ids', () => {
    const raw = { id: 'u1', name: 'Fulana', roles: { role: 'user' }, deleted: false }
    expect(mapUser(raw, ['u1'])).toEqual({ id: 'u1', nome: 'Fulana', papel: 'user', ativo: true, vendedor: true })
    expect(mapUser(raw, ['outro'])?.vendedor).toBe(false)
  })
  it('usuário apagado fica inativo e sem nome é ignorado', () => {
    expect(mapUser({ id: 'u2', name: 'X', deleted: true }, [])?.ativo).toBe(false)
    expect(mapUser({ id: 'u3' }, [])).toBeNull()
  })
})

const campo = (extra: Record<string, unknown>) => ({ customFields: [{ id: GHL_FIELD_VALOR_TRATAMENTO_ID, ...extra }] })

describe('valorTratamento', () => {
  it('lê o número que o GHL entrega', () => {
    expect(valorTratamento(campo({ fieldValueNumber: 5350, type: 'number' }))).toBe(5350)
  })
  it('aceita o valor como texto', () => {
    expect(valorTratamento(campo({ fieldValueString: '1200.5' }))).toBe(1200.5)
  })
  it('campo ausente, vazio, zero ou inválido vira null', () => {
    expect(valorTratamento({})).toBeNull()
    expect(valorTratamento({ customFields: [] })).toBeNull()
    expect(valorTratamento(campo({}))).toBeNull()
    expect(valorTratamento(campo({ fieldValueNumber: 0 }))).toBeNull()
    expect(valorTratamento(campo({ fieldValueString: 'abc' }))).toBeNull()
    expect(valorTratamento(campo({ fieldValueNumber: -10 }))).toBeNull()
  })
  it('ignora outros campos personalizados', () => {
    expect(valorTratamento({ customFields: [{ id: 'outro', fieldValueNumber: 99 }] })).toBeNull()
  })
})

describe('mapOpportunity: valor da oportunidade e valor do tratamento são campos distintos', () => {
  it('guarda os dois sem misturar', () => {
    const row = mapOpportunity(
      {
        id: 'o1',
        createdAt: '2026-09-01T12:00:00Z',
        status: 'won',
        monetaryValue: 5670,
        contactId: 'c1',
        pipelineId: 'p1',
        ...campo({ fieldValueNumber: 5350 }),
      },
      { pipelineNames: new Map([['p1', 'Qualificação ( IA )']]), contatosComTratamento: new Set() },
    )
    expect(row?.valor).toBe(5670)
    expect(row?.valor_tratamento).toBe(5350)
  })
  it('sem o campo, valor_tratamento é null e o valor da oportunidade segue', () => {
    const row = mapOpportunity(
      { id: 'o2', createdAt: '2026-09-01T12:00:00Z', status: 'open', monetaryValue: 300, pipelineId: 'p1' },
      { pipelineNames: new Map(), contatosComTratamento: new Set() },
    )
    expect(row?.valor).toBe(300)
    expect(row?.valor_tratamento).toBeNull()
  })
})
