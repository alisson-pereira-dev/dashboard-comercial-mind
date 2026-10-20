// Fuso fixo da clínica (Brasília, sem horário de verão desde 2019).
const OFFSET = '-03:00'
const OFFSET_MS = 3 * 3_600_000

/** Parte da meta de um mês que cai dentro do período (1 = mês inteiro). */
export type MetaPeso = { mes: string; fracao: number }

export type Period = {
  kind: 'mes' | 'custom'
  /** Primeiro dia (YYYY-MM-DD), inclusivo. */
  de: string
  /** Último dia (YYYY-MM-DD), inclusivo. */
  ate: string
  /** Início do período em UTC (ISO), inclusivo. */
  fromIso: string
  /** Fim do período em UTC (ISO), exclusivo. */
  toIso: string
  /** Meses (YYYY-MM-01) que o período toca e o peso da meta de cada um. */
  metaPesos: MetaPeso[]
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/
const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/

function validDate(s: string | undefined): s is string {
  if (!s || !DATE_RE.test(s)) return false
  const d = new Date(`${s}T00:00:00Z`)
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s
}

export function addDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

function lastDayOfMonth(month: string): string {
  const [y, m] = month.split('-').map(Number)
  return new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10)
}

function daysBetween(from: string, to: string): number {
  return Math.round((Date.UTC(+to.slice(0, 4), +to.slice(5, 7) - 1, +to.slice(8, 10)) -
    Date.UTC(+from.slice(0, 4), +from.slice(5, 7) - 1, +from.slice(8, 10))) / 86_400_000)
}

export function todayBR(now: Date = new Date()): string {
  return new Date(now.getTime() - OFFSET_MS).toISOString().slice(0, 10)
}

export function currentMonthBR(now: Date = new Date()): string {
  return todayBR(now).slice(0, 7)
}

// A meta é mensal. Em período parcial, cada mês entra pela fração de dias dentro do período.
function metaPesos(de: string, ate: string): MetaPeso[] {
  const out: MetaPeso[] = []
  let [y, m] = de.slice(0, 7).split('-').map(Number)
  const end = ate.slice(0, 7)
  for (;;) {
    const month = `${y}-${String(m).padStart(2, '0')}`
    const first = `${month}-01`
    const last = lastDayOfMonth(month)
    const from = de > first ? de : first
    const to = ate < last ? ate : last
    const diasNoPeriodo = daysBetween(from, to) + 1
    const diasNoMes = daysBetween(first, last) + 1
    out.push({ mes: first, fracao: diasNoPeriodo / diasNoMes })
    if (month >= end) break
    m += 1
    if (m > 12) {
      m = 1
      y += 1
    }
  }
  return out
}

function build(kind: Period['kind'], de: string, ate: string): Period {
  return {
    kind,
    de,
    ate,
    fromIso: new Date(`${de}T00:00:00${OFFSET}`).toISOString(),
    toIso: new Date(`${addDays(ate, 1)}T00:00:00${OFFSET}`).toISOString(),
    metaPesos: metaPesos(de, ate),
  }
}

export function parsePeriod(
  params: { mes?: string; de?: string; ate?: string },
  now: Date = new Date(),
): Period {
  if (validDate(params.de) && validDate(params.ate) && params.de <= params.ate) {
    return build('custom', params.de, params.ate)
  }
  const mes = params.mes && MONTH_RE.test(params.mes) ? params.mes : currentMonthBR(now)
  return build('mes', `${mes}-01`, lastDayOfMonth(mes))
}

export const PRESETS = [
  { id: 'mes_atual', label: 'Mês atual' },
  { id: 'mes_anterior', label: 'Mês anterior' },
  { id: 'ultimos_7', label: 'Últimos 7 dias' },
  { id: 'ultimos_30', label: 'Últimos 30 dias' },
] as const

export type PresetId = (typeof PRESETS)[number]['id']

/** Datas de um atalho de período, a partir de `hoje` (YYYY-MM-DD, fuso de Brasília). */
export function presetRange(id: PresetId, hoje: string): { de: string; ate: string } {
  switch (id) {
    case 'mes_atual':
      return { de: `${hoje.slice(0, 7)}-01`, ate: lastDayOfMonth(hoje.slice(0, 7)) }
    case 'mes_anterior': {
      const prev = addDays(`${hoje.slice(0, 7)}-01`, -1).slice(0, 7)
      return { de: `${prev}-01`, ate: lastDayOfMonth(prev) }
    }
    case 'ultimos_7':
      return { de: addDays(hoje, -6), ate: hoje }
    case 'ultimos_30':
      return { de: addDays(hoje, -29), ate: hoje }
  }
}
