import type { ValoresConsulta } from '@/lib/metrics/faturamento'

// Lista das linhas que formam o cartão "Em consultas" (regra de 26/10/2026, de volta ao calendário do GHL,
// como na "Etapa 1" original: a mudança de base de data do funil havia feito o faturamento usar a etapa do
// pipeline por engano, e o cliente pediu para desfazer só essa parte). O cartão soma
//   (agendadas - comparecidas) x R$ 160 + comparecidas x R$ 320  =  agendadas x R$ 160 + comparecidas x R$ 160
// em que agendadas são os agendamentos do calendário não cancelados (pela data de CRIAÇÃO do agendamento) e
// comparecidas são os agendamentos marcados como "compareceu" (pela data de ATUALIZAÇÃO, quando o status
// mudou). As duas vêm da MESMA tabela (agendamentos), com datas diferentes: um agendamento criado e também
// marcado como comparecido dentro do mesmo período gera DUAS linhas (soma R$ 320 ao todo).

export type AgendamentoAgendado = {
  id: string
  contato_id: string | null
  data_inicio: string
  criado_em: string
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
  /** Data que põe a linha no período: criação do agendamento (agendada) ou marcação do comparecimento. */
  data: string
  /** Data e hora da consulta, do calendário. */
  consultaEm: string
  valor: number
}

export function montarConsultas(
  agendados: AgendamentoAgendado[],
  comparecimentos: Comparecimento[],
  nomes: Map<string, string | null>,
  valores: ValoresConsulta,
): { consultas: ConsultaLinha[]; total: number } {
  const nome = (contatoId: string | null) =>
    (contatoId ? nomes.get(contatoId)?.trim() : '') || 'Sem nome no GHL'

  const consultas: ConsultaLinha[] = [
    ...agendados.map(
      (a): ConsultaLinha => ({
        id: `agendada-${a.id}`,
        tipo: 'agendada',
        paciente: nome(a.contato_id),
        data: a.criado_em,
        consultaEm: a.data_inicio,
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
