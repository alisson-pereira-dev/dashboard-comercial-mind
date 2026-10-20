import { GHL_FIELD_INICIO_TRATAMENTO_ID, GHL_FIELD_MQL_ID, VENDEDOR_PADRAO_ID } from './config'

type Raw = Record<string, unknown>

export type ContatoRow = {
  id: string
  nome: string | null
  origem: string | null
  criado_em: string
  data_inicio_tratamento: string | null
  responsavel_id: string | null
  responsavel_padrao: boolean
  atualizado_em_ghl: string | null
}

export type OportunidadeRow = {
  id: string
  contato_id: string | null
  pipeline_id: string | null
  pipeline_nome: string
  estagio_id: string | null
  tipo: 'consulta' | 'tratamento'
  valor: number
  status: 'aberta' | 'ganha' | 'perdida'
  mql: boolean
  criado_em: string
  fechado_em: string | null
  responsavel_id: string | null
  responsavel_padrao: boolean
  atualizado_em_ghl: string | null
}

export type AgendamentoRow = {
  id: string
  contato_id: string | null
  data_inicio: string
  criado_em: string
  status: 'agendado' | 'compareceu' | 'nao_compareceu' | 'cancelado'
  responsavel_id: string | null
  responsavel_padrao: boolean
  atualizado_em_ghl: string | null
}

export type UsuarioRow = {
  id: string
  nome: string
  papel: string | null
  ativo: boolean
  vendedor: boolean
}

export function mapUser(raw: Raw, vendedoresIds: string[]): UsuarioRow | null {
  const id = str(raw.id)
  const nome = str(raw.name) ?? str(raw.firstName)
  if (!id || !nome) return null
  const roles = (raw.roles ?? {}) as Raw
  return {
    id,
    nome,
    papel: str(roles.role),
    ativo: raw.deleted !== true,
    vendedor: vendedoresIds.includes(id),
  }
}

// Dono do registro: o responsável do GHL; sem responsável, o vendedor padrão.
export function resolveOwner(
  assignedTo: unknown,
  padraoId: string | null = VENDEDOR_PADRAO_ID,
): { responsavel_id: string | null; responsavel_padrao: boolean } {
  const id = str(assignedTo)
  if (id) return { responsavel_id: id, responsavel_padrao: false }
  return { responsavel_id: padraoId, responsavel_padrao: padraoId !== null }
}

const str = (v: unknown): string | null => (typeof v === 'string' && v !== '' ? v : null)

// GHL devolve datas como ISO ou como milissegundos (número ou texto numérico).
export function parseGhlDate(v: unknown): Date | null {
  if (v === null || v === undefined || v === '') return null
  const d =
    typeof v === 'number' || (typeof v === 'string' && /^\d{10,}$/.test(v))
      ? new Date(Number(v))
      : new Date(String(v))
  return Number.isNaN(d.getTime()) ? null : d
}

const iso = (v: unknown): string | null => parseGhlDate(v)?.toISOString() ?? null

function customFieldValue(contact: Raw, fieldId: string): unknown {
  const fields = Array.isArray(contact.customFields) ? (contact.customFields as Raw[]) : []
  const f = fields.find((x) => x.id === fieldId)
  return f ? (f.value ?? f.fieldValueString ?? null) : null
}

export function mapContact(raw: Raw): ContatoRow | null {
  const id = str(raw.id)
  const criado = iso(raw.dateAdded)
  if (!id || !criado) return null
  const inicio = parseGhlDate(customFieldValue(raw, GHL_FIELD_INICIO_TRATAMENTO_ID))
  return {
    id,
    nome: str(raw.contactName) ?? str(raw.firstName),
    origem: str(raw.source),
    criado_em: criado,
    data_inicio_tratamento: inicio ? inicio.toISOString().slice(0, 10) : null,
    ...resolveOwner(raw.assignedTo),
    atualizado_em_ghl: iso(raw.dateUpdated),
  }
}

export function mapOpportunityStatus(status: unknown): OportunidadeRow['status'] {
  if (status === 'won') return 'ganha'
  if (status === 'lost' || status === 'abandoned') return 'perdida'
  return 'aberta'
}

export function isMql(raw: Raw): boolean {
  const fields = Array.isArray(raw.customFields) ? (raw.customFields as Raw[]) : []
  const f = fields.find((x) => x.id === GHL_FIELD_MQL_ID)
  if (!f) return false
  const arr = f.fieldValueArray
  if (Array.isArray(arr)) return arr.length > 0
  return Boolean(f.fieldValueString ?? f.value)
}

export type OpportunityContext = {
  pipelineNames: Map<string, string>
  contatosComTratamento: Set<string>
}

export function mapOpportunity(raw: Raw, ctx: OpportunityContext): OportunidadeRow | null {
  const id = str(raw.id)
  const criado = iso(raw.createdAt)
  if (!id || !criado) return null
  const status = mapOpportunityStatus(raw.status)
  const contatoId = str(raw.contactId)
  const pipelineId = str(raw.pipelineId)
  return {
    id,
    contato_id: contatoId,
    pipeline_id: pipelineId,
    pipeline_nome: (pipelineId && ctx.pipelineNames.get(pipelineId)) || 'desconhecido',
    estagio_id: str(raw.pipelineStageId),
    tipo: contatoId && ctx.contatosComTratamento.has(contatoId) ? 'tratamento' : 'consulta',
    valor: Number(raw.monetaryValue) || 0,
    status,
    mql: isMql(raw),
    criado_em: criado,
    fechado_em: status === 'aberta' ? null : iso(raw.lastStatusChangeAt),
    ...resolveOwner(raw.assignedTo),
    atualizado_em_ghl: iso(raw.updatedAt),
  }
}

export function mapAppointmentStatus(status: unknown): AgendamentoRow['status'] {
  switch (String(status ?? '').toLowerCase()) {
    case 'showed':
      return 'compareceu'
    case 'noshow':
      return 'nao_compareceu'
    case 'cancelled':
    case 'canceled':
    case 'invalid':
      return 'cancelado'
    default:
      return 'agendado'
  }
}

export function mapEvent(raw: Raw): AgendamentoRow | null {
  const id = str(raw.id)
  const inicio = iso(raw.startTime)
  if (!id || !inicio || raw.deleted === true) return null
  return {
    id,
    contato_id: str(raw.contactId),
    data_inicio: inicio,
    criado_em: iso(raw.dateAdded) ?? inicio,
    status: mapAppointmentStatus(raw.appointmentStatus ?? raw.status),
    ...resolveOwner(raw.assignedUserId),
    atualizado_em_ghl: iso(raw.dateUpdated),
  }
}
