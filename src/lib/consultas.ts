import type { ValoresConsulta } from '@/lib/metrics/faturamento'

// Lista das linhas que formam o cartão "Em consultas" (regra de 26/10/2026). O cartão soma
//   (agendadas - comparecidas) x R$ 160 + comparecidas x R$ 320  =  agendadas x R$ 160 + comparecidas x R$ 160
// em que agendadas são as oportunidades na etapa Consulta Agendada (pela data da mudança de etapa) e
// comparecidas são os agendamentos marcados como "compareceu" (pela data da atualização). Por isso a lista
// tem dois tipos de linha: cada oportunidade agendada vale R$ 160 e cada comparecimento ACRESCENTA R$ 160
// (a consulta passa a valer R$ 320 no lugar dos R$ 160). A soma é igual ao cartão.

export type OportunidadeAgendada = {
  id: string
  contato_id: string | null
  etapa_alterada_em: string
}

export type Comparecimento = {
  id: string
  contato_id: string | null
  data_inicio: string
  atualizado_em_ghl: string
}

export type ConsultaLinha = {
  id: string
  tipo: 'agendada' | 'compareceu'
  paciente: string
  /** Data que põe a linha no período: mudança de etapa (agendada) ou marcação do comparecimento. */
  data: string
  /** Data e hora da consulta, quando a linha vem de um agendamento do calendário. */
  consultaEm: string | null
  valor: number
}

export function montarConsultas(
  agendadas: OportunidadeAgendada[],
  comparecimentos: Comparecimento[],
  nomes: Map<string, string | null>,
  valores: ValoresConsulta,
): { consultas: ConsultaLinha[]; total: number } {
  const nome = (contatoId: string | null) =>
    (contatoId ? nomes.get(contatoId)?.trim() : '') || 'Sem nome no GHL'

  const consultas: ConsultaLinha[] = [
    ...agendadas.map(
      (o): ConsultaLinha => ({
        id: `agendada-${o.id}`,
        tipo: 'agendada',
        paciente: nome(o.contato_id),
        data: o.etapa_alterada_em,
        consultaEm: null,
        valor: valores.agendada,
      }),
    ),
    ...comparecimentos.map(
      (a): ConsultaLinha => ({
        id: `compareceu-${a.id}`,
        tipo: 'compareceu',
        paciente: nome(a.contato_id),
        data: a.atualizado_em_ghl,
        consultaEm: a.data_inicio,
        valor: valores.comparecida - valores.agendada,
      }),
    ),
  ].sort((x, y) => x.data.localeCompare(y.data))

  return { consultas, total: consultas.reduce((acc, c) => acc + c.valor, 0) }
}
