// Junta a ordem salva pelo usuário com os ids que existem hoje:
// ids salvos que não existem mais são ignorados e ids novos vão para o fim.
export function applyOrder(defaultIds: string[], saved: unknown): string[] {
  if (!Array.isArray(saved)) return defaultIds
  const valid = saved.filter((x): x is string => typeof x === 'string' && defaultIds.includes(x))
  const unique = [...new Set(valid)]
  return [...unique, ...defaultIds.filter((id) => !unique.includes(id))]
}

export function sameOrder(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every((id, i) => id === b[i])
}
