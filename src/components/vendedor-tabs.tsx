'use client'

import { useState } from 'react'
import Link from 'next/link'
import { LoaderCircle } from 'lucide-react'
import { useNavegar } from './navegacao'

export type VendedorTab = { id: string | null; label: string; href: string }

export function VendedorTabs({
  tabs,
  selected,
  note,
}: {
  tabs: VendedorTab[]
  selected: string | null
  note?: string
}) {
  const { pending: isPending, navegar } = useNavegar()
  // A aba clicada já aparece como ativa enquanto a página carrega os números.
  const [clicked, setClicked] = useState<string | null | undefined>(undefined)

  if (tabs.length <= 1) return null

  const current = isPending && clicked !== undefined ? clicked : selected

  return (
    <div>
      <nav aria-label="Vendedor" className="flex flex-wrap items-center gap-2" aria-busy={isPending}>
        <span className="mr-1 text-sm font-medium text-muted">Vendedor</span>
        {tabs.map((t) => {
          const active = t.id === current
          const loading = isPending && active && t.id !== selected
          return (
            <Link
              key={t.id ?? 'clinica'}
              href={t.href}
              scroll={false}
              aria-current={active ? 'true' : undefined}
              onClick={(e) => {
                // Ctrl, Cmd e botão do meio continuam abrindo em outra aba.
                if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return
                e.preventDefault()
                if (t.id === selected) return
                setClicked(t.id)
                navegar(t.href, { scroll: false })
              }}
              className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-colors duration-200 ${
                active ? 'bg-navy text-white' : 'border border-border bg-card text-navy hover:border-brand'
              }`}
            >
              {t.label}
              {loading ? <LoaderCircle aria-hidden className="size-4 animate-spin" /> : null}
            </Link>
          )
        })}
      </nav>
      {isPending ? (
        <p role="status" className="mt-2 text-xs text-muted">
          Atualizando os números...
        </p>
      ) : note ? (
        <p className="mt-2 text-xs text-muted">{note}</p>
      ) : null}
    </div>
  )
}
