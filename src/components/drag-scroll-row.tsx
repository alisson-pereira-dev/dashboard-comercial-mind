'use client'

import { useRef, type PointerEvent, type ReactNode } from 'react'

// Limiar de movimento (px) antes de tratar o gesto como arraste de verdade. Sem isso, um clique comum
// (sem mover o mouse) já chamaria setPointerCapture no pointerdown, e o navegador entrega o "click" que
// vem depois ao elemento que capturou o ponteiro, não ao alvo real sob o cursor: um clique no corpo de um
// cartão dentro da faixa pararia de abrir a lista de detalhe. Mesmo valor do PointerSensor do dnd-kit.
const LIMIAR_PX = 6

// Faixa que rola na horizontal arrastando com o mouse (além do toque, que já rola sozinho). Clique num
// elemento interativo (a alça de reordenar, o "!", um link) não inicia a rolagem, para não brigar com o
// dnd-kit nem com os cliques normais do cartão. Só passa a capturar o ponteiro (e então rolar) quando o
// movimento ultrapassa o limiar; um clique simples, sem arrastar, nunca é afetado.
export function DragScrollRow({ children, className }: { children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null)
  const arrasto = useRef({ ativo: false, capturado: false, x: 0, scroll: 0 })

  function onPointerDown(e: PointerEvent<HTMLDivElement>) {
    const el = ref.current
    if (!el) return
    const alvo = e.target as HTMLElement
    if (alvo.closest('button, a, input, [role=img]')) return
    arrasto.current = { ativo: true, capturado: false, x: e.clientX, scroll: el.scrollLeft }
  }

  function onPointerMove(e: PointerEvent<HTMLDivElement>) {
    const el = ref.current
    const a = arrasto.current
    if (!el || !a.ativo) return
    const dx = e.clientX - a.x
    if (!a.capturado) {
      if (Math.abs(dx) < LIMIAR_PX) return
      a.capturado = true
      el.setPointerCapture(e.pointerId)
    }
    el.scrollLeft = a.scroll - dx
  }

  function onPointerUp(e: PointerEvent<HTMLDivElement>) {
    if (arrasto.current.capturado) ref.current?.releasePointerCapture(e.pointerId)
    arrasto.current.ativo = false
    arrasto.current.capturado = false
  }

  return (
    <div
      ref={ref}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      className={`scrollbar-hide cursor-grab overflow-x-auto overscroll-x-contain active:cursor-grabbing ${className ?? ''}`}
    >
      {children}
    </div>
  )
}
