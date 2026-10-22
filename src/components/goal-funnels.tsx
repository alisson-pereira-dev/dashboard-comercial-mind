import type { GoalStatus, MetricKey, Rates } from '@/lib/metrics'
import { goalProgress, goalStatus } from '@/lib/metrics'
import { formatInt, formatPercent } from '@/lib/format'
import { InfoTip } from './info-tip'

export type FunnelStage = {
  key: MetricKey
  label: string
  help: string
  value: number
  meta: number | null
}

// Largura de cada etapa em % do funil. O formato é ilustrativo: não é proporcional aos números.
export const WIDTHS = [100, 88, 76, 64, 54]
export const STAGE_H = 78
export const GAP = 14
export const PITCH = STAGE_H + GAP
// Espaços laterais do funil (telas grandes): à direita, setas e balões das taxas entre etapas;
// à esquerda, o balão da taxa lead -> consulta agendada.
const SIDE = 150
const SIDE_L = 150
export const FUNNEL_PAD = 'lg:pl-[150px] lg:pr-[150px]'
const ARROW_H = 80

const REAL_BG = ['#0B7F98', '#27C2DA', '#6ED9EB', '#9BE5F1', '#BFEFF7']
export const GOAL_BG = '#BDEBFA'

const RATE_NAMES = ['qualificação', 'agendamento', 'comparecimento', 'conversão'] as const
const RATE_TITLES = [
  'Leads qualificados ÷ leads',
  'Consultas agendadas ÷ leads qualificados (do MQL para a consulta)',
  'Comparecimentos ÷ consultas agendadas',
  'Vendas ÷ comparecimentos',
]
// Taxa extra, à esquerda do funil, entre Leads qualificados e Consultas agendadas.
export const LEFT_RATE = {
  i: 1,
  name: 'agend. sobre leads',
  title: 'Consultas agendadas ÷ leads totais (do lead direto para a consulta)',
} as const

const STATUS_DOT: Record<GoalStatus, string> = {
  abaixo: 'var(--status-abaixo)',
  na_meta: 'var(--status-na-meta)',
  acima: 'var(--status-acima)',
  sem_meta: 'var(--subtle)',
}
const STATUS_TEXT: Record<GoalStatus, string> = {
  abaixo: 'Abaixo da meta',
  na_meta: 'Na meta',
  acima: 'Acima da meta',
  sem_meta: 'Sem meta',
}

// Quanto cada lado do trapézio entra, em % da largura da própria etapa.
function insetOf(i: number) {
  const last = WIDTHS.length - 1
  const diff = i < last ? WIDTHS[i] - WIDTHS[i + 1] : WIDTHS[i - 1] - WIDTHS[i]
  return (diff / 2 / WIDTHS[i]) * 100
}

// Borda direita da etapa i, em calc() sobre a largura do funil (sem os espaços laterais).
export const edge = (i: number, extra = '0px') =>
  `calc(${SIDE_L}px + (100% - ${SIDE_L + SIDE}px) * ${0.5 + WIDTHS[i] / 200} + ${extra})`

// Borda esquerda da etapa i, na mesma escala.
export const leftEdge = (i: number, extra = '0px') =>
  `calc(${SIDE_L}px + (100% - ${SIDE_L + SIDE}px) * ${0.5 - WIDTHS[i] / 200} + ${extra})`

// O fundo recortado fica separado do conteúdo, para o balão do "!" não ser cortado.
export function Shape({
  i,
  stage,
  bg,
  children,
}: {
  i: number
  /** Chave da etapa: a mesma etapa dos dois funis acende junto ao passar o mouse. */
  stage: string
  bg: string
  children: React.ReactNode
}) {
  const clip = (() => {
    const inset = insetOf(i)
    return `polygon(0 0, 100% 0, ${100 - inset}% 100%, ${inset}% 100%)`
  })()
  return (
    <div
      className="funnel-stage relative mx-auto"
      data-stage={stage}
      style={{ width: `${WIDTHS[i]}%`, height: STAGE_H }}
    >
      {/* O brilho (filter) fica só na camada do fundo: filter num ancestral quebraria a posição
          do balão do "!", que usa position fixed. O recorte também define a área do mouse. */}
      <div aria-hidden className="stage-fx absolute inset-0">
        <div className="absolute inset-0" style={{ background: bg, clipPath: clip }} />
        <div className="stage-shine absolute inset-0" style={{ clipPath: clip }} />
      </div>
      <div className="pointer-events-none relative flex h-full flex-col items-center justify-center px-5 text-center [&_button]:pointer-events-auto [&_input]:pointer-events-auto [&_[role=img]]:pointer-events-auto">
        {children}
      </div>
    </div>
  )
}

function RateChip({ value, name, title }: { value: number | null; name: string; title?: string }) {
  return (
    <div className="rounded-2xl bg-brand-50 px-3 py-1.5 text-center" title={title}>
      <p className="text-sm font-bold leading-tight text-navy">
        {value === null ? '-' : formatPercent(value)}
      </p>
      <p className="text-[11px] leading-tight text-brand-ink">{name}</p>
    </div>
  )
}

// Altura da seta da esquerda, que liga Leads (etapa 0) a Consultas agendadas (etapa 2).
const SPAN_H = 2 * PITCH - 12
// Posição do balão da esquerda: no meio da seta, a sua esquerda. Medidas relativas à borda
// esquerda da etapa 2 (onde a seta termina).
export const LEFT_CHIP = {
  left: (extra = '0px') => leftEdge(LEFT_RATE.i + 1, `calc(-161px + ${extra})`),
  top: STAGE_H * 0.5 + SPAN_H / 2 - 22,
}

// Seta curva que liga uma etapa à seguinte (telas grandes).
export function Arrow({ i }: { i: number }) {
  return (
    <svg
      aria-hidden
      className="absolute hidden lg:block"
      width="56"
      height={ARROW_H}
      viewBox={`0 0 56 ${ARROW_H}`}
      fill="none"
      style={{ left: edge(i + 1, '-4px'), top: i * PITCH + STAGE_H * 0.5 }}
    >
      <path
        d={`M 38 2 C 60 6, 60 ${ARROW_H - 20}, 14 ${ARROW_H - 8}`}
        stroke="#0B6E8A"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path
        d={`M 22 ${ARROW_H - 17} L 13 ${ARROW_H - 8} L 25 ${ARROW_H - 4}`}
        stroke="#0B6E8A"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

// Seta curva da esquerda: sai de Leads e chega em Consultas agendadas (lead -> consulta direto).
// É o espelho das setas da direita, só que mais comprida.
export function ArrowSpan() {
  return (
    <svg
      aria-hidden
      className="absolute hidden lg:block"
      width="56"
      height={SPAN_H}
      viewBox={`0 0 56 ${SPAN_H}`}
      fill="none"
      style={{ left: leftEdge(LEFT_RATE.i + 1, '-52px'), top: STAGE_H * 0.5 }}
    >
      <path
        d={`M 18 2 C -4 6, -4 ${SPAN_H - 20}, 42 ${SPAN_H - 8}`}
        stroke="#0B6E8A"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path
        d={`M 34 ${SPAN_H - 17} L 43 ${SPAN_H - 8} L 31 ${SPAN_H - 4}`}
        stroke="#0B6E8A"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function Funnel({
  heading,
  stages,
  rates,
  mode,
}: {
  heading: string
  stages: FunnelStage[]
  rates: Rates
  mode: 'realizado' | 'meta'
}) {
  const rateValues = [rates.qualificacao, rates.agendamento, rates.comparecimento, rates.conversaoConsulta]

  return (
    <div>
      <h3 className="text-center text-sm font-bold uppercase tracking-wide text-navy">{heading}</h3>

      <div className="relative mt-4">
        <div className={`flex flex-col gap-1.5 lg:gap-[14px] ${FUNNEL_PAD}`}>
          {stages.map((s, i) => {
            const progress = goalProgress(s.value, s.meta)
            const status = goalStatus(s.value, s.meta)
            const dark = mode === 'realizado' && i === 0
            return (
              <div key={s.key}>
                <Shape i={i} stage={s.key} bg={mode === 'realizado' ? REAL_BG[i] : GOAL_BG}>
                  <p
                    className={`flex items-center gap-1.5 text-[13px] font-semibold ${
                      dark ? 'text-white' : 'text-navy'
                    }`}
                  >
                    {s.label}
                    {mode === 'realizado' ? (
                      <InfoTip label={s.label} text={s.help} tone={dark ? 'dark' : 'light'} />
                    ) : null}
                  </p>
                  <p className={`text-2xl font-bold leading-tight ${dark ? 'text-white' : 'text-navy'}`}>
                    {mode === 'realizado' ? formatInt(s.value) : s.meta !== null ? formatInt(s.meta) : '-'}
                  </p>

                  {mode === 'realizado' ? (
                    <div className={`flex w-full max-w-[88%] items-center gap-2 text-[11px] ${dark ? 'text-white' : 'text-navy'}`}>
                      <div
                        className={`h-1.5 flex-1 overflow-hidden rounded-full ${dark ? 'bg-white/35' : 'bg-white/70'}`}
                        role="progressbar"
                        aria-label={`${s.label}: ${STATUS_TEXT[status]}`}
                        aria-valuemin={0}
                        aria-valuemax={100}
                        aria-valuenow={progress === null ? 0 : Math.min(100, Math.round(progress * 100))}
                      >
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: `${progress === null ? 0 : Math.min(100, progress * 100)}%`,
                            background: dark ? '#00E5FF' : 'var(--brand)',
                          }}
                        />
                      </div>
                      <span className="whitespace-nowrap font-medium">
                        {progress === null ? 'Sem meta' : `${formatPercent(progress)} da meta`}
                      </span>
                      <span
                        role="img"
                        aria-label={STATUS_TEXT[status]}
                        title={STATUS_TEXT[status]}
                        className="size-2.5 shrink-0 rounded-full ring-2 ring-white"
                        style={{ background: STATUS_DOT[status] }}
                      />
                    </div>
                  ) : (
                    <p className="text-[11px] text-navy/80">
                      {s.meta !== null ? 'Meta do período' : 'Sem meta cadastrada'}
                    </p>
                  )}
                </Shape>

                {/* Celular: a taxa aparece entre as etapas, em linha */}
                {i < stages.length - 1 ? (
                  <div className="mt-1.5 flex justify-center gap-2 lg:hidden">
                    {i === LEFT_RATE.i ? (
                      <RateChip value={rates.agendamentoLead} name={LEFT_RATE.name} title={LEFT_RATE.title} />
                    ) : null}
                    <RateChip value={rateValues[i]} name={RATE_NAMES[i]} title={RATE_TITLES[i]} />
                  </div>
                ) : null}
              </div>
            )
          })}
        </div>

        {/* Telas grandes: setas curvas e balões ao lado do funil */}
        {RATE_NAMES.map((name, i) => (
          <div key={name} className="hidden lg:block">
            <Arrow i={i} />
            <div
              className="absolute w-[104px]"
              style={{
                left: edge(i + 1, '60px'),
                top: i * PITCH + STAGE_H + GAP / 2 - 22,
              }}
            >
              <RateChip value={rateValues[i]} name={name} title={RATE_TITLES[i]} />
            </div>
          </div>
        ))}

        {/* Telas grandes: balão da taxa lead -> consulta agendada, à esquerda do funil */}
        <ArrowSpan />
        <div
          className="absolute hidden w-[104px] lg:block"
          style={{ left: LEFT_CHIP.left(), top: LEFT_CHIP.top }}
        >
          <RateChip value={rates.agendamentoLead} name={LEFT_RATE.name} title={LEFT_RATE.title} />
        </div>
      </div>
    </div>
  )
}

export function GoalFunnels({
  stages,
  rates,
  idealRates,
}: {
  stages: FunnelStage[]
  rates: Rates
  idealRates: Rates
}) {
  return (
    <div className="funnels grid gap-10 xl:grid-cols-2 xl:gap-0">
      <div className="xl:pr-6">
        <Funnel heading="Realizado" stages={stages} rates={rates} mode="realizado" />
      </div>
      <div className="xl:border-l xl:border-border xl:pl-6">
        <Funnel heading="Ideal / Metas" stages={stages} rates={idealRates} mode="meta" />
      </div>
    </div>
  )
}
