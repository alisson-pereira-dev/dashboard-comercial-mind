'use client'

import { useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { currentMonthBR } from '@/lib/metrics/period'

const MESES_CURTOS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']

// Grade de meses (YYYY-MM) com navegação por ano. `selected` pode ser null.
export function MonthGrid({
  selected,
  onPick,
}: {
  selected: string | null
  onPick: (month: string) => void
}) {
  const [year, setYear] = useState(Number((selected ?? currentMonthBR()).slice(0, 4)))

  const arrow =
    'flex size-8 items-center justify-center rounded-full text-muted hover:bg-black/[0.04] hover:text-navy'

  return (
    <div>
      <div className="flex items-center justify-between">
        <button type="button" aria-label="Ano anterior" className={arrow} onClick={() => setYear((y) => y - 1)}>
          <ChevronLeft aria-hidden className="size-4" />
        </button>
        <span className="text-sm font-semibold text-navy">{year}</span>
        <button type="button" aria-label="Próximo ano" className={arrow} onClick={() => setYear((y) => y + 1)}>
          <ChevronRight aria-hidden className="size-4" />
        </button>
      </div>
      <div className="mt-3 grid grid-cols-3 gap-2">
        {MESES_CURTOS.map((nome, i) => {
          const month = `${year}-${String(i + 1).padStart(2, '0')}`
          const active = month === selected
          return (
            <button
              key={month}
              type="button"
              aria-pressed={active}
              onClick={() => onPick(month)}
              className={`rounded-xl px-3 py-2.5 text-sm font-medium capitalize transition-colors duration-200 ${
                active ? 'bg-navy text-white' : 'text-navy hover:bg-brand-50'
              }`}
            >
              {nome}
            </button>
          )
        })}
      </div>
      <button
        type="button"
        className="mt-3 w-full rounded-xl py-2 text-sm font-medium text-brand-ink hover:bg-brand-50"
        onClick={() => onPick(currentMonthBR())}
      >
        Este mês
      </button>
    </div>
  )
}
