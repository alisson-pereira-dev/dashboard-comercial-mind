import 'server-only'

const BASE = 'https://services.leadconnectorhq.com'
const VERSION = '2021-07-28'
const MAX_TENTATIVAS = 5

export function ghlCredentials() {
  const token = process.env.GHL_TOKEN
  const locationId = process.env.GHL_LOCATION_ID
  if (!token || !locationId) {
    throw new Error('GHL_TOKEN e GHL_LOCATION_ID precisam estar definidos no ambiente.')
  }
  return { token, locationId }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

// GET com retentativa em 429 e 5xx (backoff exponencial). Nunca inclui o token em erros.
export async function ghlGet<T>(path: string): Promise<T> {
  const { token } = ghlCredentials()
  const url = path.startsWith('http') ? path : `${BASE}${path}`
  // O token só pode ir para o host do GHL, mesmo que a API devolva um link de próxima página.
  if (!url.startsWith(`${BASE}/`)) throw new Error('URL fora do host do GHL.')

  for (let tentativa = 1; ; tentativa++) {
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}`, Version: VERSION, Accept: 'application/json' },
      cache: 'no-store',
    })
    if (res.ok) return (await res.json()) as T

    const retentavel = res.status === 429 || res.status >= 500
    if (retentavel && tentativa < MAX_TENTATIVAS) {
      const retryAfter = Number(res.headers.get('retry-after'))
      await sleep(retryAfter > 0 ? retryAfter * 1000 : 1000 * 2 ** (tentativa - 1))
      continue
    }
    const corpo = (await res.text()).slice(0, 200)
    throw new Error(`GHL ${res.status} em ${new URL(url).pathname}: ${corpo}`)
  }
}

type Page = { meta?: { nextPageUrl?: string | null } } & Record<string, unknown>

// Percorre uma lista paginada e devolve uma página por vez (itens em `key`).
export async function* ghlPages<T>(firstPath: string, key: string): AsyncGenerator<T[]> {
  let next: string | null = firstPath
  while (next) {
    const page: Page = await ghlGet<Page>(next)
    const items = (page[key] as T[] | undefined) ?? []
    if (items.length === 0) return
    yield items
    next = page.meta?.nextPageUrl ?? null
  }
}
