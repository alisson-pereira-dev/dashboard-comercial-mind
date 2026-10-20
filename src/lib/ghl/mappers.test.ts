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
} from './mappers'
import { GHL_FIELD_INICIO_TRATAMENTO_ID, GHL_FIELD_MQL_ID } from './config'

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
  }
  it('mapeia venda ganha como consulta quando o contato não tem início de tratamento', () => {
    const row = mapOpportunity(base, ctx)
    expect(row).toMatchObject({
      tipo: 'consulta',
      status: 'ganha',
      valor: 1500,
      pipeline_nome: 'Qualificação ( IA )',
      fechado_em: '2026-10-10T10:00:00.000Z',
    })
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
