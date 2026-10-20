import { CircleAlert } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { formatPercent } from '@/lib/format'
import { InfoTip } from './info-tip'

const R = 46
const C = 2 * Math.PI * R

// Anel de progresso: preenchido pela taxa; tracejado e com "-" quando não há base de cálculo.
function Donut({ value, Icon }: { value: number | null; Icon: LucideIcon }) {
  return (
    <div className="relative size-[104px] shrink-0 sm:size-[116px]" aria-hidden>
      <svg viewBox="0 0 120 120" className="size-full">
        {value === null ? (
          <circle
            cx="60"
            cy="60"
            r={R}
            fill="none"
            stroke="var(--track)"
            strokeWidth="12"
            strokeDasharray="7 9"
            strokeLinecap="round"
          />
        ) : (
          <>
            <circle cx="60" cy="60" r={R} fill="none" stroke="var(--track)" strokeWidth="12" />
            {value > 0 ? (
              <circle
                cx="60"
                cy="60"
                r={R}
                fill="none"
                stroke="var(--brand)"
                strokeWidth="12"
                strokeLinecap="round"
                strokeDasharray={`${C * Math.min(value, 1)} ${C}`}
                transform="rotate(-90 60 60)"
              />
            ) : null}
          </>
        )}
      </svg>
      <span className="absolute inset-0 flex items-center justify-center">
        <span
          className={`flex size-[62px] items-center justify-center rounded-full ${
            value === null ? 'bg-black/[0.04] text-muted' : 'bg-brand-50 text-brand-ink'
          }`}
        >
          {value === null ? <span className="text-xl font-bold">-</span> : <Icon className="size-7" />}
        </span>
      </span>
    </div>
  )
}

export function RateCard({
  icon: Icon,
  label,
  help,
  value,
  from,
  to,
  caption,
}: {
  icon: LucideIcon
  label: string
  help: string
  value: number | null
  from: string
  to: string
  caption: string
}) {
  return (
    <div className="card flex items-center justify-between gap-4 p-5 sm:p-6">
      <div className="min-w-0">
        <div className="flex items-center gap-3">
          <span
            aria-hidden
            className="flex size-10 shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand-ink"
          >
            <Icon className="size-5" />
          </span>
          <p className="flex items-center gap-2 text-[15px] font-semibold text-navy">
            {label}
            <InfoTip label={label} text={help} />
          </p>
        </div>

        <p className="mt-4 text-[44px] font-bold leading-none tracking-tight text-navy">
          {value === null ? '-' : formatPercent(value)}
        </p>

        <p className="mt-3 flex flex-wrap items-center gap-2 text-xs font-semibold text-brand-ink">
          <span className="rounded-full bg-brand-50 px-2.5 py-1">{from}</span>
          <span aria-hidden>→</span>
          <span className="rounded-full bg-brand-50 px-2.5 py-1">{to}</span>
        </p>

        <p className="mt-3 text-sm text-muted">{caption}</p>

        {value === null ? (
          <p className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-black/[0.04] px-3 py-1 text-xs text-muted">
            <CircleAlert aria-hidden className="size-3.5" />
            Sem base para cálculo
          </p>
        ) : null}
      </div>

      <Donut value={value} Icon={Icon} />
    </div>
  )
}
