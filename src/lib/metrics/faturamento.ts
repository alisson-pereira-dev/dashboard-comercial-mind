// Faturamento em consultas (regras de 23 e 26/10/2026, "Etapa 1"): cada consulta agendada no CALENDÁRIO
// do GHL vale um valor fixo (R$ 160) e, quando é marcada como comparecida, passa a valer outro (R$ 320).
// O valor de comparecida SUBSTITUI o de agendada, não soma.
//   Em consultas = (agendadas - comparecidas) x 160 + comparecidas x 320
// Agendadas = agendamentos não cancelados criados no período (criado_em). Comparecidas = agendamentos
// marcados como "compareceu", pela data em que foram atualizados (atualizado_em_ghl), decisão de
// 26/10/2026. Como são datas diferentes na mesma tabela, comparecidas pode passar de agendadas (por
// exemplo, um agendamento criado num mês e marcado como comparecido no mês seguinte). A fórmula vale do
// mesmo jeito (equivale a agendadas x 160 + comparecidas x 160) e não é limitada.
// Este número é INDEPENDENTE do cartão "Consultas agendadas" do funil, que desde 26/10/2026 conta
// oportunidades na etapa do pipeline (outra fonte, outra data): ver `queries.ts` (`faturamento_agendadas`
// x `consultas_agendadas`) e `lib/consultas.ts` (a lista de detalhe usa agendamentos, não oportunidades).
export type ValoresConsulta = { agendada: number; comparecida: number }

export function faturamentoConsultas(agendadas: number, comparecidas: number, valores: ValoresConsulta): number {
  const a = Math.max(agendadas, 0)
  const c = Math.max(comparecidas, 0)
  return (a - c) * valores.agendada + c * valores.comparecida
}
