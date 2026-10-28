'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, Target } from 'lucide-react'

const base =
  'flex items-center gap-3 rounded-full px-4 py-2.5 text-sm font-medium transition-colors duration-200'
const inativo = 'text-muted hover:bg-black/[0.04] hover:text-navy'

const ITENS = [
  { href: '/', label: 'Realizados', Icone: LayoutDashboard },
  { href: '/metas', label: 'Metas', Icone: Target },
]

// Menu do app: Realizados (dashboard, rota "/") e Metas, cada uma com a própria página.
export function NavLinks({ direction }: { direction: 'vertical' | 'horizontal' }) {
  const pathname = usePathname()

  return (
    <nav aria-label="Principal" className={direction === 'vertical' ? 'flex flex-col gap-1' : 'flex gap-1'}>
      {ITENS.map(({ href, label, Icone }) => {
        const ativo = href === '/' ? pathname === '/' : pathname.startsWith(href)
        return (
          <Link
            key={href}
            href={href}
            aria-current={ativo ? 'page' : undefined}
            className={`${base} ${ativo ? 'bg-navy text-white' : inativo}`}
          >
            <Icone aria-hidden className="size-[18px]" />
            {label}
          </Link>
        )
      })}
    </nav>
  )
}
