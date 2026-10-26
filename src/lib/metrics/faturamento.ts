// Faturamento em consultas (regras de 23 e 26/10/2026): cada consulta agendada vale um valor fixo
// (R$ 160) e, quando é marcada como comparecida, passa a valer outro (R$ 320). O valor de comparecida
// SUBSTITUI o de agendada, não soma.
//   Em consultas = (agendadas - comparecidas) x 160 + comparecidas x 320
// Desde 26/10/2026 as agendadas são as oportunidades na etapa Consulta Agendada e as comparecidas são
// agendamentos do calendário (fontes diferentes, cada uma com a sua data), então comparecidas pode passar
// de agendadas, por exemplo quando o lead já saiu da etapa Consulta Agendada. A fórmula vale do mesmo
// jeito (equivale a agendadas x 160 + comparecidas x 160) e não é limitada.
export type ValoresConsulta = { agendada: number; comparecida: number }

export function faturamentoConsultas(agendadas: number, comparecidas: number, valores: ValoresConsulta): number {
  const a = Math.max(agendadas, 0)
  const c = Math.max(comparecidas, 0)
  return (a - c) * valores.agendada + c * valores.comparecida
}
