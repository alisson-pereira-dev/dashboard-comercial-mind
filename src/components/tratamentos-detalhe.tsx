'use client'

import type { ReactNode } from 'react'
import { formatDateTime, formatMoney } from '@/lib/format'
import { listarTratamentos, type TratamentosResultado } from '@/lib/tratamentos-actions'
import { DetalheJanela } from '@/components/detalhe-janela'

type Dados = Extract<TratamentosResultado, { ok: true }>

// Lista das oportunidades ganhas que formam o cartão "Em tratamentos".
export function TratamentosDetalhe({
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
      titulo={`Tratamentos de ${periodo}`}
      descricao='São as oportunidades do pipeline Qualificação (IA) marcadas como ganhas no período, que formam o valor de "Em tratamentos". Cada uma vale o valor da oportunidade no GHL.'
      nota='O período vale pela data em que a oportunidade foi marcada como ganha, e não pela data em que foi criada. O valor da oportunidade pode incluir o valor da consulta, que também aparece em "Em consultas".'
      textoVazio="Nenhuma oportunidade foi marcada como ganha neste período."
      carregar={async () => {
        const r = await listarTratamentos({ inicio, fim, vendedorId })
        return r.ok ? { ok: true, dados: r } : r
      }}
      vazio={(d) => d.tratamentos.length === 0}
      tabela={(d) => (
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted">
              <th scope="col" className="py-2 pr-3 font-semibold">Paciente</th>
              <th scope="col" className="py-2 pr-3 font-semibold">Ganha em</th>
              <th scope="col" className="hidden py-2 pr-3 font-semibold sm:table-cell">Criada em</th>
              <th scope="col" className="py-2 text-right font-semibold">Valor</th>
            </tr>
          </thead>
          <tbody>
            {d.tratamentos.map((t) => (
              <tr key={t.id} className="border-b border-border/70 last:border-0">
                <td className="py-2.5 pr-3 font-medium">{t.paciente}</td>
                <td className="py-2.5 pr-3 tabular-nums">{formatDateTime(t.fechadoEm)}</td>
                <td className="hidden py-2.5 pr-3 tabular-nums text-muted sm:table-cell">
                  {formatDateTime(t.criadoEm)}
                </td>
                <td className="py-2.5 text-right font-semibold tabular-nums">{formatMoney(t.valor)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-border">
              <td colSpan={2} className="pt-3 text-sm font-semibold">
                Total ({d.tratamentos.length} {d.tratamentos.length === 1 ? 'oportunidade' : 'oportunidades'})
              </td>
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
