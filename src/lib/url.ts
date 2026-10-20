type Params = Record<string, string | string[] | undefined>

// Monta um link mantendo os parâmetros atuais e trocando (ou removendo) um deles.
export function hrefWith(path: string, params: Params, key: string, value: string | null): string {
  const q = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) {
    const first = Array.isArray(v) ? v[0] : v
    if (k !== key && first) q.set(k, first)
  }
  if (value) q.set(key, value)
  const s = q.toString()
  return s ? `${path}?${s}` : path
}
