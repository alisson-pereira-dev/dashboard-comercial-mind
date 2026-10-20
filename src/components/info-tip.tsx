'use client'

import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { useDismiss } from '@/lib/use-dismiss'

const LARGURA = 256
const MARGEM = 8

// "!" que explica o que a métrica mede. Abre ao passar o mouse, focar ou tocar.
// O balão usa posição fixa para não ser cortado por tabelas com rolagem.
export function InfoTip({
  label,
  text,
  tone = 'light',
}: {
  label: string
  text: string
  tone?: 'light' | 'dark'
}) {
  const id = useId()
  const rootRef = useRef<HTMLSpanElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const [hover, setHover] = useState(false)
  const [pinned, setPinned] = useState(false)
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null)
  const open = hover || pinned

  const unpin = useCallback(() => setPinned(false), [])
  useDismiss(pinned, unpin, rootRef)

  useEffect(() => {
    if (!open || !buttonRef.current) return
    const rect = buttonRef.current.getBoundingClientRect()
    const left = Math.min(Math.max(rect.left, MARGEM), window.innerWidth - LARGURA - MARGEM)
    setPos({ top: rect.bottom + 8, left })
    const close = () => {
      setHover(false)
      setPinned(false)
    }
    window.addEventListener('scroll', close, true)
    window.addEventListener('resize', close)
    return () => {
      window.removeEventListener('scroll', close, true)
      window.removeEventListener('resize', close)
    }
  }, [open])

  const tone_cls =
    tone === 'dark'
      ? 'border-white/50 text-white/80 hover:bg-white/10'
      : 'border-subtle text-muted hover:border-navy hover:text-navy'

  return (
    <span
      ref={rootRef}
      className="relative inline-flex"
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      <button
        ref={buttonRef}
        type="button"
        aria-label={`Sobre ${label}`}
        aria-describedby={open ? id : undefined}
        aria-expanded={open}
        onClick={() => setPinned((v) => !v)}
        onFocus={() => setHover(true)}
        onBlur={() => setHover(false)}
        className={`flex size-[18px] items-center justify-center rounded-full border text-[11px] font-bold leading-none transition-colors duration-200 ${tone_cls}`}
      >
        !
      </button>
      {open && pos ? (
        <span
          id={id}
          role="tooltip"
          style={{ position: 'fixed', top: pos.top, left: pos.left, width: LARGURA }}
          className="z-[100] rounded-xl bg-navy px-3.5 py-3 text-xs font-normal leading-relaxed text-white shadow-xl"
        >
          {text}
        </span>
      ) : null}
    </span>
  )
}
