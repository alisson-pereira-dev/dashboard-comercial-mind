'use client'

import { useRef, useState, type ReactNode } from 'react'
import { LoaderCircle, X } from 'lucide-react'

type Resultado<T> = { ok: true; dados: T } | { ok: false; erro: string }
type Estado<T> = { tipo: 'fechado' } | { tipo: 'carregando' } | { tipo: 'pronto'; resultado: Resultado<T> }

// Envolve um cartão: clicar nele (ou no botão "Ver ...", que fica dentro do cartão e tem o atributo
// data-abre-detalhe) abre uma janela com a lista que forma o valor. O resto do cartão (o "!" e a alça de
// arrastar) continua funcionando: cliques em outros botões não abrem a janela.
export function DetalheJanela<T>({
  children,
  titulo,
  descricao,
  nota,
  textoVazio,
  carregar,
  vazio,
  tabela,
}: {
  children: ReactNode
  titulo: string
  descricao: string
  nota: string
  textoVazio: string
  carregar: () => Promise<Resultado<T>>
  vazio: (dados: T) => boolean
  tabela: (dados: T) => ReactNode
}) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const [estado, setEstado] = useState<Estado<T>>({ tipo: 'fechado' })

  async function abrir() {
    dialogRef.current?.showModal()
    setEstado({ tipo: 'carregando' })
    const resultado = await carregar()
    setEstado({ tipo: 'pronto', resultado })
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
        aria-labelledby="detalhe-titulo"
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
              <h2 id="detalhe-titulo" className="text-xl font-bold tracking-tight">
                {titulo}
              </h2>
              <p className="mt-1 text-sm text-muted">{descricao}</p>
            </div>
            <button type="button" className="btn btn-ghost btn-sm shrink-0" onClick={fechar} aria-label="Fechar">
              <X aria-hidden className="size-4" />
            </button>
          </header>

          <div className="min-h-0 flex-1 overflow-auto p-5">
            {estado.tipo === 'carregando' ? (
              <p role="status" className="flex items-center gap-2 text-sm text-muted">
                <LoaderCircle aria-hidden className="size-4 animate-spin" />
                Carregando...
              </p>
            ) : estado.tipo === 'pronto' && !estado.resultado.ok ? (
              <p role="alert" className="text-sm text-status-abaixo">
                {estado.resultado.erro}
              </p>
            ) : estado.tipo === 'pronto' && estado.resultado.ok ? (
              vazio(estado.resultado.dados) ? (
                <p className="text-sm text-muted">{textoVazio}</p>
              ) : (
                <div className="overflow-x-auto">{tabela(estado.resultado.dados)}</div>
              )
            ) : null}
          </div>

          <footer className="border-t border-border bg-black/[0.02] p-4 text-xs text-muted">{nota}</footer>
        </div>
      </dialog>
    </div>
  )
}
