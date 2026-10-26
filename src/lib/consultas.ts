import { valorDaConsulta, type ValoresConsulta } from '@/lib/metrics/faturamento'

// Lista das consultas que formam o cartão "Em consultas": quem é o paciente, quando é a consulta,
// quando foi agendada, em que situação está e quanto vale. Montada com a MESMA regra do cartão
// (agendamentos criados no período, sem os cancelados), então a soma dos valores é igual ao cartão.

export type AgendamentoRow = {
  id: string
  contato_id: string | null
  data_inicio: string
  criado_em: string
  status: string
}

export type ConsultaLinha = {
  id: string
  paciente: string
  /** Data e hora da consulta. */
  inicio: string
  /** Quando o agendamento foi criado (é essa data que define o período). */
  criadoEm: string
  status: 'agendado' | 'compareceu' | 'nao_compareceu'
  valor: number
}

export function montarConsultas(
  agendamentos: AgendamentoRow[],
  nomes: Map<string, string | null>,
  valores: ValoresConsulta,
): { consultas: ConsultaLinha[]; total: number } {
  const consultas = agendamentos
    .filter((a) => a.status !== 'cancelado')
    .map((a): ConsultaLinha => {
      const nome = a.contato_id ? nomes.get(a.contato_id)?.trim() : ''
      return {
        id: a.id,
        paciente: nome || 'Sem nome no GHL',
        inicio: a.data_inicio,
        criadoEm: a.criado_em,
        status: a.status === 'compareceu' || a.status === 'nao_compareceu' ? a.status : 'agendado',
        valor: valorDaConsulta(a.status, valores),
      }
    })
    .sort((x, y) => x.inicio.localeCompare(y.inicio))
  return { consultas, total: consultas.reduce((acc, c) => acc + c.valor, 0) }
}
