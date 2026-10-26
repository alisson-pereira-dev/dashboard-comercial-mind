'use client'

import type { ReactNode } from 'react'
import { formatDateTime, formatMoney } from '@/lib/format'
import { listarConsultas, type ConsultasResultado } from '@/lib/consultas-actions'
import { DetalheJanela } from '@/components/detalhe-janela'

const SITUACAO = {
  agendada: { texto: 'Agendada', classe: 'bg-brand-50 text-brand-ink' },
  compareceu: { texto: 'Compareceu (+R$ 160)', classe: 'bg-emerald-100 text-emerald-800' },
} as const

type Dados = Extract<ConsultasResultado, { ok: true }>

// Lista das linhas que formam o cartão "Em consultas".
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
      descricao='São as linhas que formam o valor de "Em consultas": cada oportunidade que entrou na etapa Consulta Agendada vale R$ 160, e cada comparecimento marcado no período acrescenta R$ 160 (a consulta passa a valer R$ 320, no lugar dos 160).'
      nota='O período vale pela data em que a oportunidade mudou para a etapa Consulta Agendada e pela data em que o agendamento foi marcado como compareceu. Só aparecem oportunidades que ainda estão na etapa Consulta Agendada.'
      textoVazio="Nenhuma oportunidade entrou na etapa Consulta Agendada e nenhum comparecimento foi marcado neste período."
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
              <th scope="col" className="hidden py-2 pr-3 font-semibold sm:table-cell">Situação</th>
              <th scope="col" className="py-2 pr-3 font-semibold">Data</th>
              <th scope="col" className="py-2 text-right font-semibold">Valor</th>
            </tr>
          </thead>
          <tbody>
            {d.consultas.map((c) => (
              <tr key={c.id} className="border-b border-border/70 last:border-0">
                <td className="py-2.5 pr-3 font-medium">
                  {c.paciente}
                  <span
                    className={`mt-1 flex w-fit rounded-full px-2 py-0.5 text-xs font-semibold sm:hidden ${SITUACAO[c.tipo].classe}`}
                  >
                    {SITUACAO[c.tipo].texto}
                  </span>
                </td>
                <td className="hidden py-2.5 pr-3 sm:table-cell">
                  <span
                    className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${SITUACAO[c.tipo].classe}`}
                  >
                    {SITUACAO[c.tipo].texto}
                  </span>
                </td>
                <td className="py-2.5 pr-3 tabular-nums">
                  {formatDateTime(c.data)}
                  {c.consultaEm ? (
                    <span className="block text-xs text-muted">Consulta em {formatDateTime(c.consultaEm)}</span>
                  ) : null}
                </td>
                <td className="py-2.5 text-right font-semibold tabular-nums">{formatMoney(c.valor)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-border">
              <td className="pt-3 text-sm font-semibold">
                Total ({d.consultas.length} {d.consultas.length === 1 ? 'linha' : 'linhas'})
              </td>
              <td className="hidden sm:table-cell" />
              <td />
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
