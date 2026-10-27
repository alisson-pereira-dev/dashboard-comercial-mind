'use client'

import { useRef, type PointerEvent, type ReactNode } from 'react'

// Faixa que rola na horizontal arrastando com o mouse (além do toque, que já rola sozinho). Clique num
// elemento interativo (a alça de reordenar, o "!", um link) não inicia a rolagem, para não brigar com o
// dnd-kit nem com os cliques normais do cartão.
export function DragScrollRow({ children, className }: { children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null)
  const arrasto = useRef({ ativo: false, x: 0, scroll: 0 })

  function onPointerDown(e: PointerEvent<HTMLDivElement>) {
    const el = ref.current
    if (!el) return
    const alvo = e.target as HTMLElement
    if (alvo.closest('button, a, input, [role=img]')) return
    arrasto.current = { ativo: true, x: e.clientX, scroll: el.scrollLeft }
    el.setPointerCapture(e.pointerId)
  }

  function onPointerMove(e: PointerEvent<HTMLDivElement>) {
    const el = ref.current
    if (!el || !arrasto.current.ativo) return
    el.scrollLeft = arrasto.current.scroll - (e.clientX - arrasto.current.x)
  }

  function onPointerUp(e: PointerEvent<HTMLDivElement>) {
    arrasto.current.ativo = false
    ref.current?.releasePointerCapture(e.pointerId)
  }

  return (
    <div
      ref={ref}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      className={`cursor-grab overflow-x-auto overscroll-x-contain active:cursor-grabbing ${className ?? ''}`}
    >
      {children}
    </div>
  )
}
