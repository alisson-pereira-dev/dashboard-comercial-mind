'use client'

import { Calculator, Pencil } from 'lucide-react'
import { METRIC_LABELS, type MetricKey } from '@/lib/metrics'
import { ETAPAS_FUNIL, TAXAS, agendamentoSobreLeads, type Modo, type TaxaKey, type Taxas, type Valores } from '@/lib/metas-edit'
import { Arrow, ArrowSpan, FUNNEL_PAD, GAP, GOAL_BG, LEFT_CHIP, LEFT_RATE, PITCH, STAGE_H, Shape, edge } from './goal-funnels'

// Destaque nos campos que acabaram de ser calculados automaticamente.
export const DESTAQUE = 'border-brand bg-brand-50 ring-2 ring-brand/40'

function ValorEtapa({
  chave,
  valor,
  calculado,
  recemCalculado,
  disabled,
  onChange,
}: {
  chave: MetricKey
  valor: string
  /** Etapa calculada pelas taxas: aparece como leitura, sem lápis. */
  calculado: boolean
  recemCalculado: boolean
  disabled: boolean
  onChange: (texto: string) => void
}) {
  return (
    <div className="relative">
      <input
        type="number"
        inputMode="numeric"
        min="0"
        step="1"
        aria-label={`Meta de ${METRIC_LABELS[chave]}${calculado ? ' (calculada pelas taxas)' : ''}`}
        value={valor}
        disabled={disabled}
        readOnly={calculado}
        tabIndex={calculado ? -1 : undefined}
        placeholder="0"
        onChange={(e) => onChange(e.target.value)}
        className={`no-spin h-8 w-[116px] rounded-lg border py-0 pl-2 pr-7 text-center text-lg font-bold text-navy outline-none transition-colors duration-200 ${
          calculado
            ? `cursor-default border-dashed border-brand/50 bg-white/50 ${recemCalculado ? DESTAQUE : ''}`
            : 'border-border bg-white focus:border-brand'
        }`}
      />
      {calculado ? (
        <Calculator aria-hidden className="pointer-events-none absolute right-2 top-1/2 size-3.5 -translate-y-1/2 text-brand-ink" />
      ) : (
        <Pencil aria-hidden className="pointer-events-none absolute right-2 top-1/2 size-3.5 -translate-y-1/2 text-muted" />
      )}
    </div>
  )
}

function TaxaEditor({
  indice,
  valor,
  editavel,
  disabled,
  onChange,
}: {
  indice: number
  valor: string
  /** Automático: a taxa é digitada. Manual: é só uma leitura. */
  editavel: boolean
  disabled: boolean
  onChange: (texto: string) => void
}) {
  const t = TAXAS[indice]
  return (
    <div
      className={`rounded-2xl px-2 py-1.5 text-center ${editavel ? 'bg-white shadow-sm ring-1 ring-brand/40' : 'bg-brand-50'}`}
      title={`${t.nome}: ${t.formula}`}
    >
      <div className="flex items-center justify-center gap-0.5 text-sm font-bold text-navy">
        {editavel ? (
          <>
            <input
              type="number"
              inputMode="decimal"
              min="0"
              step="any"
              aria-label={`Taxa de ${t.nome} (percentual)`}
              value={valor}
              disabled={disabled}
              placeholder="0"
              onChange={(e) => onChange(e.target.value)}
              className="no-spin w-[48px] rounded-md border border-border bg-white py-0.5 pr-1 text-right font-bold outline-none transition-colors duration-200 focus:border-brand"
            />
            <span aria-hidden>%</span>
          </>
        ) : (
          <span aria-label={`Taxa de ${t.nome}: ${valor === '' ? 'sem dados' : valor + ' por cento'}`}>
            {valor === '' ? '-' : `${valor} %`}
          </span>
        )}
      </div>
      <p className="text-[11px] leading-tight text-brand-ink">{t.nome}</p>
    </div>
  )
}

// Balão só de leitura: consultas agendadas sobre os leads totais (não é digitado nem calcula nada).
function TaxaLeitura({ valor }: { valor: string }) {
  return (
    <div className="rounded-2xl bg-brand-50 px-2 py-1.5 text-center" title={LEFT_RATE.title}>
      <p
        className="text-sm font-bold text-navy"
        aria-label={`Taxa de agendamento sobre os leads: ${valor === '' ? 'sem dados' : valor + ' por cento'}`}
      >
        {valor === '' ? '-' : `${valor} %`}
      </p>
      <p className="text-[11px] leading-tight text-brand-ink">{LEFT_RATE.name}</p>
    </div>
  )
}

// Funil de metas editável. No modo automático digita-se os Leads e as taxas; no manual, cada etapa.
// Quem calcula o que muda é `editar` em lib/metas-edit.ts.
export function MetasFunnel({
  modo,
  valores,
  taxas,
  auto,
  disabled,
  onValor,
  onTaxa,
}: {
  modo: Modo
  valores: Valores
  taxas: Taxas
  auto: ReadonlySet<MetricKey>
  disabled: boolean
  onValor: (chave: MetricKey, texto: string) => void
  onTaxa: (chave: TaxaKey, texto: string) => void
}) {
  const automatico = modo === 'automatico'
  const agendSobreLeads = agendamentoSobreLeads(valores)

  return (
    <div className="relative">
      <div className={`flex flex-col gap-1.5 lg:gap-[14px] ${FUNNEL_PAD}`}>
        {ETAPAS_FUNIL.map((key, i) => {
          const calculado = automatico && key !== 'leads'
          return (
            <div key={key}>
              <Shape i={i} stage={key} bg={GOAL_BG}>
                <p className="text-[13px] font-semibold text-navy">{METRIC_LABELS[key]}</p>
                <ValorEtapa
                  chave={key}
                  valor={valores[key]}
                  calculado={calculado}
                  recemCalculado={auto.has(key)}
                  disabled={disabled}
                  onChange={(t) => onValor(key, t)}
                />
                <p className="text-[11px] text-navy/80">{calculado ? 'calculado pelas taxas' : 'Meta do período'}</p>
              </Shape>

              {/* Celular e telas médias: a taxa fica entre as etapas, em linha */}
              {i < TAXAS.length ? (
                <div className="mt-1.5 flex items-center justify-center gap-2 lg:hidden">
                  {i === LEFT_RATE.i ? <TaxaLeitura valor={agendSobreLeads} /> : null}
                  <TaxaEditor
                    indice={i}
                    valor={taxas[TAXAS[i].key]}
                    editavel={automatico}
                    disabled={disabled}
                    onChange={(t) => onTaxa(TAXAS[i].key, t)}
                  />
                </div>
              ) : null}
            </div>
          )
        })}
      </div>

      {/* Telas grandes: setas curvas e taxas ao lado do funil */}
      {TAXAS.map((t, i) => (
        <div key={t.key} className="hidden lg:block">
          <Arrow i={i} />
          <div
            className="absolute w-[108px]"
            style={{ left: edge(i + 1, '60px'), top: i * PITCH + STAGE_H + GAP / 2 - 24 }}
          >
            <TaxaEditor
              indice={i}
              valor={taxas[t.key]}
              editavel={automatico}
              disabled={disabled}
              onChange={(x) => onTaxa(t.key, x)}
            />
          </div>
        </div>
      ))}

      {/* Telas grandes: taxa lead -> consulta agendada, à esquerda do funil */}
      <ArrowSpan />
      <div
        className="absolute hidden w-[108px] lg:block"
        style={{ left: LEFT_CHIP.left('-4px'), top: LEFT_CHIP.top - 2 }}
      >
        <TaxaLeitura valor={agendSobreLeads} />
      </div>
    </div>
  )
}
