'use client'

import type { ReactNode } from 'react'
import { formatDateTime, formatMoney } from '@/lib/format'
import { listarFechamentos, type FechamentosResultado } from '@/lib/fechamentos-actions'
import { DetalheJanela } from '@/components/detalhe-janela'

type Dados = Extract<FechamentosResultado, { ok: true }>

const TEXTOS = {
  consulta: {
    titulo: 'Fechamentos em consulta',
    descricao:
      'São as oportunidades do pipeline Qualificação (IA) marcadas como ganhas no período, que estão na etapa Consulta Agendada.',
    vazio: 'Nenhuma oportunidade foi marcada como ganha na etapa Consulta Agendada neste período.',
  },
  followup: {
    titulo: 'Fechamentos em follow up',
    descricao:
      'São as oportunidades do pipeline Qualificação (IA) marcadas como ganhas no período, que estão na etapa Pós consulta.',
    vazio: 'Nenhuma oportunidade foi marcada como ganha na etapa Pós consulta neste período.',
  },
} as const

// Lista das oportunidades ganhas que formam os cartões "Fechamentos em consulta" e "Fechamentos em
// follow up" (ou a taxa de conversão da respectiva etapa): quem é o lead que fechou.
export function FechamentosDetalhe({
  children,
  etapa,
  etapaId,
  inicio,
  fim,
  vendedorId,
  periodo,
}: {
  children: ReactNode
  /** Qual dos dois fechamentos: define os textos da janela. */
  etapa: 'consulta' | 'followup'
  /** Id da etapa no GHL (ETAPA_CONSULTA_AGENDADA_ID ou ETAPA_POS_CONSULTA_ID), para filtrar a busca. */
  etapaId: string
  inicio: string
  fim: string
  vendedorId: string | null
  periodo: string
}) {
  const t = TEXTOS[etapa]
  return (
    <DetalheJanela<Dados>
      titulo={`${t.titulo} de ${periodo}`}
      descricao={t.descricao}
      nota='O período vale pela data em que a oportunidade foi marcada como ganha, e não pela data em que foi criada. Usa a etapa em que a oportunidade está agora.'
      textoVazio={t.vazio}
      carregar={async () => {
        const r = await listarFechamentos({ inicio, fim, vendedorId, etapaId })
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
