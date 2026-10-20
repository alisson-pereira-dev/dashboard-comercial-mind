import { CircleCheck, CircleMinus, TrendingDown, TrendingUp } from 'lucide-react'
import type { GoalStatus } from '@/lib/metrics'
import { formatPercent } from '@/lib/format'

export const STATUS_LABEL: Record<GoalStatus, string> = {
  abaixo: 'Abaixo da meta',
  na_meta: 'Na meta',
  acima: 'Acima da meta',
  sem_meta: 'Sem meta',
}

const STYLE: Record<GoalStatus, { cls: string; Icon: typeof TrendingUp }> = {
  abaixo: { cls: 'bg-[var(--status-abaixo-bg)] text-[var(--status-abaixo-ink)]', Icon: TrendingDown },
  na_meta: { cls: 'bg-[var(--status-na-meta-bg)] text-[var(--status-na-meta-ink)]', Icon: CircleCheck },
  acima: { cls: 'bg-[var(--status-acima-bg)] text-[var(--status-acima-ink)]', Icon: TrendingUp },
  sem_meta: { cls: 'bg-[var(--status-sem-meta-bg)] text-[var(--status-sem-meta-ink)]', Icon: CircleMinus },
}

// Status comunicado por ícone e texto, além da cor.
export function StatusPill({
  status,
  progress,
  count,
  label,
  compact = false,
}: {
  status: GoalStatus
  progress?: number | null
  count?: number
  label?: string
  /** Só ícone e percentual, para espaços estreitos. O texto completo fica no aria-label. */
  compact?: boolean
}) {
  const { cls, Icon } = STYLE[status]
  const hasProgress = progress !== null && progress !== undefined
  const text = compact
    ? hasProgress
      ? formatPercent(progress)
      : ''
    : `${count !== undefined ? `${count} ${label ?? STATUS_LABEL[status]}` : STATUS_LABEL[status]}${
        hasProgress ? ` (${formatPercent(progress)})` : ''
      }`

  return (
    <span
      aria-label={compact ? `${STATUS_LABEL[status]}${hasProgress ? ` (${formatPercent(progress)})` : ''}` : undefined}
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold ${cls}`}
    >
      <Icon aria-hidden className="size-3.5" />
      {text}
    </span>
  )
}
