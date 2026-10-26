import type { LucideIcon } from 'lucide-react'
import { goalProgress, goalStatus } from '@/lib/metrics'
import { formatInt, formatMoney, formatPercent } from '@/lib/format'
import { InfoTip } from './info-tip'
import { StatusPill } from './status-pill'

function IconCircle({ Icon }: { Icon: LucideIcon }) {
  return (
    <span aria-hidden className="flex size-10 shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand-ink">
      <Icon className="size-5" />
    </span>
  )
}

// Número com meta: valor grande, meta, barra de progresso e selo de status.
export function GoalCard({
  icon,
  label,
  info,
  realizado,
  meta,
  money = false,
  highlight = false,
  standalone = false,
  compacto = false,
  rodape,
}: {
  icon: LucideIcon
  label: string
  info: string
  realizado: number
  meta: number | null
  money?: boolean
  /** Destaque do Total: fundo azulado e faixa ciano no topo. */
  highlight?: boolean
  /** Cartão solto na página (com sombra), em vez de cartão dentro de outro. */
  standalone?: boolean
  /**
   * Para cartões lado a lado em uma linha só (Números de vendas): cabeçalho com altura de duas linhas e o
   * selo de status no pé do cartão, para o número ficar na mesma altura em todos os cartões da linha.
   */
  compacto?: boolean
  /** Ação no pé do cartão (por exemplo, "Ver as consultas"). */
  rodape?: React.ReactNode
}) {
  const fmt = money ? formatMoney : formatInt
  const progress = goalProgress(realizado, meta)
  const status = goalStatus(realizado, meta)

  const shell = standalone
    ? 'card'
    : highlight
      ? 'rounded-2xl border border-brand/30 border-t-4 border-t-brand bg-brand-50'
      : 'rounded-2xl border border-border bg-card'

  return (
    <div className={`${shell} flex flex-col p-5`}>
      <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-2">
        <div className={`flex min-w-0 items-center gap-3 ${compacto ? 'min-h-12' : ''}`}>
          <IconCircle Icon={icon} />
          <p className="flex min-w-0 items-center gap-2 text-balance text-[15px] font-semibold text-navy">
            {label}
            <InfoTip label={label} text={info} />
          </p>
        </div>
        {compacto ? null : <StatusPill status={status} />}
      </div>

      <p className="mt-4 text-[32px] font-bold leading-none tracking-tight text-navy">{fmt(realizado)}</p>
      <p className="mt-2 text-sm text-muted">
        {meta !== null ? `Meta: ${fmt(meta)}${money ? '' : ` ${label.toLowerCase()}`}` : 'Sem meta no período'}
      </p>

      <div
        className="mt-3 h-2.5 overflow-hidden rounded-full bg-track"
        role="progressbar"
        aria-label={`${label}: ${progress === null ? 'sem meta' : formatPercent(progress)} da meta`}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={progress === null ? 0 : Math.min(100, Math.round(progress * 100))}
      >
        <div
          className="bar-fill bar-brand h-full rounded-full"
          style={{ width: `${progress === null ? 0 : Math.min(100, progress * 100)}%` }}
        />
      </div>
      <p className="mt-2 text-xs text-muted">
        {progress === null ? (
          'Cadastre a meta em Metas.'
        ) : (
          <>
            <strong className="font-semibold text-navy">{formatPercent(progress)}</strong> da meta
          </>
        )}
      </p>
      {compacto ? (
        <div className="mt-3">
          <StatusPill status={status} />
        </div>
      ) : null}
      {rodape ? <div className="mt-3">{rodape}</div> : null}
    </div>
  )
}

// Número sem meta (tratamentos novos, fechamentos em consulta e em follow up). Usado lado a lado com os
// GoalCard compactos, então o cabeçalho tem a mesma altura mínima (duas linhas).
export function CountCard({
  icon,
  label,
  info,
  value,
}: {
  icon: LucideIcon
  label: string
  info: string
  value: number
}) {
  return (
    <div className="card flex flex-col p-5">
      <div className="flex min-h-12 items-center gap-3">
        <IconCircle Icon={icon} />
        <p className="flex min-w-0 items-center gap-2 text-balance text-[15px] font-semibold text-navy">
          {label}
          <InfoTip label={label} text={info} />
        </p>
      </div>
      <p className="mt-4 text-[32px] font-bold leading-none tracking-tight text-navy">{formatInt(value)}</p>
      <p className="mt-2 text-sm text-muted">Sem meta cadastrada</p>
    </div>
  )
}
