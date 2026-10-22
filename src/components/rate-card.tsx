import { CircleAlert } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { formatPercent } from '@/lib/format'
import { InfoTip } from './info-tip'

const R = 46
const C = 2 * Math.PI * R

// Anel de progresso: preenchido pela taxa; tracejado e com "-" quando não há base de cálculo.
function Donut({ value, Icon }: { value: number | null; Icon: LucideIcon }) {
  return (
    <div
      className="relative size-[104px] shrink-0 self-center sm:size-[116px] @max-[330px]:size-[72px] @max-[330px]:sm:size-[72px]"
      aria-hidden
    >
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
          className={`flex size-[62px] items-center justify-center rounded-full @max-[330px]:size-[42px] ${
            value === null ? 'bg-black/[0.04] text-muted' : 'bg-brand-50 text-brand-ink'
          }`}
        >
          {value === null ? (
            <span className="text-xl font-bold">-</span>
          ) : (
            <Icon className="size-7 @max-[330px]:size-5" />
          )}
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
  // O cartão se adapta à largura que tem (container query): largo, o anel fica na direita, centrado;
  // estreito (cinco cartões numa linha), o anel diminui e vai para a linha do número.
  return (
    <div className="card @container">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-4 p-5 sm:p-6 @max-[330px]:p-4 @max-[330px]:sm:p-4">
        <div className="col-start-1 row-start-1 flex items-center gap-3 @max-[330px]:col-span-2">
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

        <p className="col-start-1 row-start-2 mt-4 self-center text-[44px] font-bold leading-none tracking-tight text-navy @max-[330px]:text-[34px]">
          {value === null ? '-' : formatPercent(value)}
        </p>

        <div className="col-start-2 row-span-5 row-start-1 flex @max-[330px]:row-span-1 @max-[330px]:row-start-2 @max-[330px]:mt-4">
          <Donut value={value} Icon={Icon} />
        </div>

        <p className="col-start-1 row-start-3 mt-3 flex flex-wrap items-center gap-2 text-xs font-semibold text-brand-ink @max-[330px]:col-span-2">
          <span className="rounded-full bg-brand-50 px-2.5 py-1">{from}</span>
          <span aria-hidden>→</span>
          <span className="rounded-full bg-brand-50 px-2.5 py-1">{to}</span>
        </p>

        <p className="col-start-1 row-start-4 mt-3 text-sm text-muted @max-[330px]:col-span-2">{caption}</p>

        {value === null ? (
          <p className="col-start-1 row-start-5 mt-3 inline-flex w-fit items-center gap-1.5 rounded-full bg-black/[0.04] px-3 py-1 text-xs text-muted @max-[330px]:col-span-2">
            <CircleAlert aria-hidden className="size-3.5" />
            Sem base para cálculo
          </p>
        ) : null}
      </div>
    </div>
  )
}
