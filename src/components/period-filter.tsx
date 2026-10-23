'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'
import { CalendarDays, ChevronDown } from 'lucide-react'
import { DayPicker, type DateRange } from 'react-day-picker'
import { ptBR } from 'react-day-picker/locale'
import 'react-day-picker/style.css'
import { brDate, monthLabel } from '@/lib/format'
import { PRESETS, presetRange, type PresetId } from '@/lib/metrics/period'
import { useDismiss } from '@/lib/use-dismiss'
import { useNavegar } from './navegacao'

type Preset = PresetId | 'personalizado'

const toDate = (s: string) => {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d)
}
const toIso = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

const isWholeMonth = (from: string, to: string) => {
  const last = new Date(+to.slice(0, 4), +to.slice(5, 7), 0).getDate()
  return from.slice(0, 7) === to.slice(0, 7) && from.slice(8) === '01' && +to.slice(8) === last
}

function detectPreset(de: string, ate: string, hoje: string): Preset {
  const hit = PRESETS.find((p) => {
    const r = presetRange(p.id, hoje)
    return r.de === de && r.ate === ate
  })
  return hit ? hit.id : 'personalizado'
}

type Props = {
  /** Prefixo dos parâmetros da URL deste filtro, ex.: "meta_" gera meta_mes, meta_de, meta_ate. */
  prefix: string
  kind: 'mes' | 'custom'
  de: string
  ate: string
  /** Hoje no fuso de Brasília (YYYY-MM-DD), vindo do servidor. */
  hoje: string
}

export function PeriodFilter({ prefix, kind, de, ate, hoje }: Props) {
  const { navegar } = useNavegar()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const rootRef = useRef<HTMLDivElement>(null)

  const [open, setOpen] = useState(false)
  const [preset, setPreset] = useState<Preset>(detectPreset(de, ate, hoje))
  const [range, setRange] = useState<DateRange | undefined>({ from: toDate(de), to: toDate(ate) })
  const [month, setMonth] = useState<Date>(toDate(de))
  const [meses, setMeses] = useState(1)

  const close = useCallback(() => setOpen(false), [])
  useDismiss(open, close, rootRef)

  // Dois meses lado a lado só em telas grandes; abaixo disso, um mês por vez.
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px)')
    const update = () => setMeses(mq.matches ? 2 : 1)
    update()
    mq.addEventListener('change', update)
    return () => mq.removeEventListener('change', update)
  }, [])

  const presetAtual = detectPreset(de, ate, hoje)
  const label =
    kind === 'mes'
      ? monthLabel(de.slice(0, 7))
      : presetAtual !== 'personalizado'
        ? (PRESETS.find((p) => p.id === presetAtual)?.label ?? '')
        : `${brDate(de)} a ${brDate(ate)}`

  function toggle() {
    if (!open) {
      // Ao abrir, o rascunho volta para o período aplicado.
      setPreset(detectPreset(de, ate, hoje))
      setRange({ from: toDate(de), to: toDate(ate) })
      setMonth(toDate(de))
    }
    setOpen((v) => !v)
  }

  function choosePreset(id: PresetId) {
    const r = presetRange(id, hoje)
    setPreset(id)
    setRange({ from: toDate(r.de), to: toDate(r.ate) })
    setMonth(toDate(r.de))
  }

  function apply() {
    if (!range?.from || !range.to) return
    const from = toIso(range.from)
    const to = toIso(range.to)
    const params = new URLSearchParams(searchParams.toString())
    for (const k of ['mes', 'de', 'ate']) params.delete(prefix + k)
    if (isWholeMonth(from, to)) {
      params.set(`${prefix}mes`, from.slice(0, 7))
    } else {
      params.set(`${prefix}de`, from)
      params.set(`${prefix}ate`, to)
    }
    setOpen(false)
    navegar(`${pathname}?${params.toString()}`, { scroll: false })
  }

  const ready = Boolean(range?.from && range.to)

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        className="btn btn-ghost btn-sm"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={toggle}
      >
        <CalendarDays aria-hidden className="size-4 text-muted" />
        {label}
        <ChevronDown aria-hidden className="size-4 text-muted" />
      </button>

      {open ? (
        <div
          role="dialog"
          aria-label="Escolher período"
          className="card fixed inset-x-4 top-24 z-50 max-h-[85vh] overflow-y-auto p-5 shadow-xl md:absolute md:inset-x-auto md:right-0 md:top-full md:mt-2 md:w-[620px] md:max-w-[calc(100vw-2rem)] lg:w-[860px]"
        >
          <div className="flex flex-col gap-5 md:flex-row">
            <div className="min-w-0 md:flex-1">
              <DayPicker
                mode="range"
                locale={ptBR}
                numberOfMonths={meses}
                month={month}
                onMonthChange={setMonth}
                selected={range}
                onSelect={(r) => {
                  setRange(r)
                  setPreset('personalizado')
                }}
                showOutsideDays
              />
            </div>

            <div className="space-y-5 md:w-[240px] md:shrink-0 md:border-l md:border-border md:pl-5">
              <div>
                <p className="text-sm font-semibold text-navy">Selecionar o intervalo de datas</p>
                <div role="radiogroup" aria-label="Atalhos de período" className="mt-2 space-y-1">
                  {PRESETS.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      role="radio"
                      aria-checked={preset === p.id}
                      onClick={() => choosePreset(p.id)}
                      className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-sm transition-colors duration-200 ${
                        preset === p.id
                          ? 'bg-navy font-medium text-white'
                          : 'text-navy hover:bg-brand-50'
                      }`}
                    >
                      {p.label}
                    </button>
                  ))}
                  <p
                    className={`rounded-xl px-3 py-2 text-sm ${
                      preset === 'personalizado' ? 'bg-brand-50 font-medium text-brand-ink' : 'text-muted'
                    }`}
                  >
                    Personalizado: escolha no calendário
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor={`${prefix}de`} className="mb-1 block text-xs font-medium text-muted">
                    De
                  </label>
                  <input
                    id={`${prefix}de`}
                    readOnly
                    value={range?.from ? brDate(toIso(range.from)) : ''}
                    placeholder="dd/mm/aaaa"
                    className="input bg-black/[0.03] px-3"
                  />
                </div>
                <div>
                  <label htmlFor={`${prefix}ate`} className="mb-1 block text-xs font-medium text-muted">
                    Para
                  </label>
                  <input
                    id={`${prefix}ate`}
                    readOnly
                    value={range?.to ? brDate(toIso(range.to)) : ''}
                    placeholder="dd/mm/aaaa"
                    className="input bg-black/[0.03] px-3"
                  />
                </div>
              </div>

              <div className="flex gap-3 border-t border-border pt-4">
                <button type="button" className="btn btn-ghost flex-1" onClick={close}>
                  Cancelar
                </button>
                <button type="button" className="btn btn-primary flex-1" disabled={!ready} onClick={apply}>
                  Aplicar
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
