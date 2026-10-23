'use client'

import { createContext, useContext, useEffect, useTransition, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'

type Navegar = (href: string, opcoes?: { scroll?: boolean }) => void
type Contexto = { pending: boolean; navegar: Navegar }

const NavegacaoContext = createContext<Contexto>({
  pending: false,
  // Fora do provider (não deveria acontecer): navegação comum, sem aviso de carregamento.
  navegar: (href) => window.location.assign(href),
})

export const useNavegar = () => useContext(NavegacaoContext)

// Navegações que trocam os números da tela (filtro de período, vendedor) mantêm a tela antiga até a
// resposta chegar. Sem aviso, parece que travou. Este provider marca a navegação como pendente,
// mostra uma barra no topo e esmaece a página (só depois de 150 ms, para não piscar quando é rápido).
export function NavegacaoProvider({ children }: { children: ReactNode }) {
  const router = useRouter()
  const [pending, start] = useTransition()

  useEffect(() => {
    document.body.toggleAttribute('data-navegando', pending)
    return () => document.body.removeAttribute('data-navegando')
  }, [pending])

  const navegar: Navegar = (href, opcoes) => start(() => router.push(href, { scroll: opcoes?.scroll ?? true }))

  return (
    <NavegacaoContext.Provider value={{ pending, navegar }}>
      <div aria-hidden className={`nav-progress ${pending ? 'nav-progress-on' : ''}`}>
        <span />
      </div>
      <p role="status" className="sr-only">
        {pending ? 'Carregando os números...' : ''}
      </p>
      {children}
    </NavegacaoContext.Provider>
  )
}
