'use client'

import type { ReactNode } from 'react'
import { formatDateTime, formatMoney } from '@/lib/format'
import { listarConsultas, type ConsultasResultado } from '@/lib/consultas-actions'
import { DetalheJanela } from '@/components/detalhe-janela'

const SITUACAO = {
  agendado: { texto: 'Agendada', classe: 'bg-brand-50 text-brand-ink' },
  compareceu: { texto: 'Compareceu', classe: 'bg-emerald-100 text-emerald-800' },
  nao_compareceu: { texto: 'Não compareceu', classe: 'bg-red-100 text-red-800' },
} as const

type Dados = Extract<ConsultasResultado, { ok: true }>

// Lista das consultas que formam o cartão "Em consultas".
export function ConsultasDetalhe({
  children,
  inicio,
  fim,
  vendedorId,
  periodo,
}: {
  children: ReactNode
  inicio: string
  fim: string
  vendedorId: string | null
  periodo: string
}) {
  return (
    <DetalheJanela<Dados>
      titulo={`Consultas de ${periodo}`}
      descricao='São as consultas que formam o valor de "Em consultas". Agendadas valem R$ 160 e, quando comparecem, R$ 320 (no lugar dos 160). Canceladas não entram.'
      nota='O período vale pela data em que o agendamento foi criado (coluna "Agendada em"), e não pela data da consulta. Só entram consultas registradas no calendário do GHL.'
      textoVazio="Nenhuma consulta agendada neste período."
      carregar={async () => {
        const r = await listarConsultas({ inicio, fim, vendedorId })
        return r.ok ? { ok: true, dados: r } : r
      }}
      vazio={(d) => d.consultas.length === 0}
      tabela={(d) => (
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted">
              <th scope="col" className="py-2 pr-3 font-semibold">Paciente</th>
              <th scope="col" className="py-2 pr-3 font-semibold">Consulta (data e hora)</th>
              <th scope="col" className="hidden py-2 pr-3 font-semibold sm:table-cell">Agendada em</th>
              <th scope="col" className="hidden py-2 pr-3 font-semibold sm:table-cell">Situação</th>
              <th scope="col" className="py-2 text-right font-semibold">Valor</th>
            </tr>
          </thead>
          <tbody>
            {d.consultas.map((c) => (
              <tr key={c.id} className="border-b border-border/70 last:border-0">
                <td className="py-2.5 pr-3 font-medium">
                  {c.paciente}
                  <span
                    className={`mt-1 flex w-fit rounded-full px-2 py-0.5 text-xs font-semibold sm:hidden ${SITUACAO[c.status].classe}`}
                  >
                    {SITUACAO[c.status].texto}
                  </span>
                </td>
                <td className="py-2.5 pr-3 tabular-nums">{formatDateTime(c.inicio)}</td>
                <td className="hidden py-2.5 pr-3 tabular-nums text-muted sm:table-cell">
                  {formatDateTime(c.criadoEm)}
                </td>
                <td className="hidden py-2.5 pr-3 sm:table-cell">
                  <span
                    className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${SITUACAO[c.status].classe}`}
                  >
                    {SITUACAO[c.status].texto}
                  </span>
                </td>
                <td className="py-2.5 text-right font-semibold tabular-nums">{formatMoney(c.valor)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-border">
              <td colSpan={2} className="pt-3 text-sm font-semibold">
                Total ({d.consultas.length} {d.consultas.length === 1 ? 'consulta' : 'consultas'})
              </td>
              <td className="hidden sm:table-cell" />
              <td className="hidden sm:table-cell" />
              <td className="pt-3 text-right text-base font-bold tabular-nums">{formatMoney(d.total)}</td>
            </tr>
          </tfoot>
        </table>
      )}
    >
      {children}
    </DetalheJanela>
  )
}
