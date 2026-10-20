import type { GoalStatus } from './types'

// Limiares provisórios. Fechar com o cliente piloto (ver CLAUDE.md, seção 6).
export const NA_META_MIN = 0.95
export const ACIMA_MIN = 1.05

export function goalProgress(realizado: number, meta: number | null): number | null {
  if (meta === null || meta <= 0) return null
  return realizado / meta
}

export function goalStatus(realizado: number, meta: number | null): GoalStatus {
  const progress = goalProgress(realizado, meta)
  if (progress === null) return 'sem_meta'
  if (progress >= ACIMA_MIN) return 'acima'
  if (progress >= NA_META_MIN) return 'na_meta'
  return 'abaixo'
}
