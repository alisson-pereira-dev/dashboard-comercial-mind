'use client'

import { useRef, useState, type ReactNode } from 'react'
import { LoaderCircle, X } from 'lucide-react'
import { formatDateTime, formatMoney } from '@/lib/format'
import { listarConsultas, type ConsultasResultado } from '@/lib/consultas-actions'

const SITUACAO = {
  agendado: { texto: 'Agendada', classe: 'bg-brand-50 text-brand-ink' },
  compareceu: { texto: 'Compareceu', classe: 'bg-emerald-100 text-emerald-800' },
  nao_compareceu: { texto: 'Não compareceu', classe: 'bg-red-100 text-red-800' },
} as const

type Estado = { tipo: 'fechado' } | { tipo: 'carregando' } | { tipo: 'pronto'; dados: ConsultasResultado }

// Envolve o cartão "Em consultas": clicar nele (ou no botão "Ver as consultas deste valor", que fica dentro
// do cartão e tem o atributo data-abre-detalhe) abre a lista de consultas que formam o valor. O resto do
// cartão (o "!" e a alça de arrastar) continua funcionando: cliques em outros botões não abrem a lista.
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
  const dialogRef = useRef<HTMLDialogElement>(null)
  const [estado, setEstado] = useState<Estado>({ tipo: 'fechado' })

  async function abrir() {
    dialogRef.current?.showModal()
    setEstado({ tipo: 'carregando' })
    const dados = await listarConsultas({ inicio, fim, vendedorId })
    setEstado({ tipo: 'pronto', dados })
  }

  const fechar = () => dialogRef.current?.close()

  return (
    <div
      className="cursor-pointer [&>:first-child]:h-full"
      onClick={(e) => {
        const alvo = e.target as HTMLElement
        const interativo = alvo.closest('button, a, input, [role=img]')
        if (interativo && !interativo.hasAttribute('data-abre-detalhe')) return
        void abrir()
      }}
    >
      {children}
      <dialog
        ref={dialogRef}
        aria-labelledby="consultas-titulo"
        onClose={() => setEstado({ tipo: 'fechado' })}
        // Clique no fundo escurecido fecha. O stopPropagation evita que o clique dentro da janela
        // chegue ao cartão e abra a lista de novo.
        onClick={(e) => {
          e.stopPropagation()
          if (e.target === dialogRef.current) fechar()
        }}
        className="m-auto max-h-[88vh] w-[min(880px,calc(100vw-2rem))] cursor-default overflow-hidden rounded-2xl bg-card p-0 text-left text-navy shadow-2xl backdrop:bg-navy/50 backdrop:backdrop-blur-[2px]"
      >
        <div className="flex max-h-[88vh] flex-col">
          <header className="flex items-start justify-between gap-4 border-b border-border p-5">
            <div>
              <h2 id="consultas-titulo" className="text-xl font-bold tracking-tight">
                Consultas de {periodo}
              </h2>
              <p className="mt-1 text-sm text-muted">
                São as consultas que formam o valor de &quot;Em consultas&quot;. Agendadas valem R$ 160 e, quando
                comparecem, R$ 320 (no lugar dos 160). Canceladas não entram.
              </p>
            </div>
            <button type="button" className="btn btn-ghost btn-sm shrink-0" onClick={fechar} aria-label="Fechar">
              <X aria-hidden className="size-4" />
            </button>
          </header>

          <div className="min-h-0 flex-1 overflow-auto p-5">
            {estado.tipo === 'carregando' ? (
              <p role="status" className="flex items-center gap-2 text-sm text-muted">
                <LoaderCircle aria-hidden className="size-4 animate-spin" />
                Carregando as consultas...
              </p>
            ) : estado.tipo === 'pronto' && !estado.dados.ok ? (
              <p role="alert" className="text-sm text-status-abaixo">
                {estado.dados.erro}
              </p>
            ) : estado.tipo === 'pronto' && estado.dados.ok ? (
              estado.dados.consultas.length === 0 ? (
                <p className="text-sm text-muted">Nenhuma consulta agendada neste período.</p>
              ) : (
                <div className="overflow-x-auto">
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
                      {estado.dados.consultas.map((c) => (
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
                          Total ({estado.dados.consultas.length}{' '}
                          {estado.dados.consultas.length === 1 ? 'consulta' : 'consultas'})
                        </td>
                        <td className="hidden sm:table-cell" />
                        <td className="hidden sm:table-cell" />
                        <td className="pt-3 text-right text-base font-bold tabular-nums">
                          {formatMoney(estado.dados.total)}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )
            ) : null}
          </div>

          <footer className="border-t border-border bg-black/[0.02] p-4 text-xs text-muted">
            O período vale pela data em que o agendamento foi criado (coluna &quot;Agendada em&quot;), e não pela data
            da consulta. Só entram consultas registradas no calendário do GHL.
          </footer>
        </div>
      </dialog>
    </div>
  )
}
