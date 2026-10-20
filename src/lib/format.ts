const int = new Intl.NumberFormat('pt-BR')
const money = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })
const pct = new Intl.NumberFormat('pt-BR', { style: 'percent', maximumFractionDigits: 1 })

export const formatInt = (n: number) => int.format(n)
export const formatMoney = (n: number) => money.format(n)

// null significa "sem dados" (denominador zero ou sem meta).
export const formatPercent = (n: number | null) => (n === null ? '-' : pct.format(n))

export function formatDateTime(iso: string): string {
  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
    timeZone: 'America/Sao_Paulo',
  }).format(new Date(iso))
}

const MESES = [
  'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro',
]

// "2026-10" vira "Outubro de 2026".
export function monthLabel(month: string): string {
  const nome = MESES[Number(month.slice(5, 7)) - 1]
  return `${nome[0].toUpperCase()}${nome.slice(1)} de ${month.slice(0, 4)}`
}

// "2026-10-05" vira "05/10/2026".
export const brDate = (s: string) => s.split('-').reverse().join('/')

export function periodLabel(p: { kind: 'mes' | 'custom'; de: string; ate: string }): string {
  return p.kind === 'mes' ? monthLabel(p.de.slice(0, 7)) : `${brDate(p.de)} a ${brDate(p.ate)}`
}
