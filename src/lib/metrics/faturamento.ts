// Faturamento em consultas (regra de 23/10/2026), calculado pelos agendamentos do calendário:
// cada consulta agendada vale um valor fixo (R$ 160) e, quando é marcada como comparecida, a
// consulta passa a valer outro (R$ 320). O valor de comparecida SUBSTITUI o de agendada, não soma.
//   Em consultas = (agendadas não comparecidas x 160) + (comparecidas x 320)
export type ValoresConsulta = { agendada: number; comparecida: number }

export function faturamentoConsultas(agendadas: number, comparecidas: number, valores: ValoresConsulta): number {
  const total = Math.max(agendadas, 0)
  // Comparecida é uma agendada que mudou de status, então nunca passa do total de agendadas.
  const comparecidasValidas = Math.min(Math.max(comparecidas, 0), total)
  return (total - comparecidasValidas) * valores.agendada + comparecidasValidas * valores.comparecida
}

// Valor de UMA consulta: R$ 320 se compareceu, R$ 160 nas demais (agendada ou que faltou).
// A soma deste valor sobre as consultas do período é igual a faturamentoConsultas.
export function valorDaConsulta(status: string, valores: ValoresConsulta): number {
  return status === 'compareceu' ? valores.comparecida : valores.agendada
}

// Quantas das oportunidades estão ganhas (status "ganha"): os tratamentos novos.
export type OportunidadeConsulta = { status?: string }

export function contaGanhas(oportunidades: OportunidadeConsulta[]): number {
  return oportunidades.filter((o) => o.status === 'ganha').length
}
