'use client'

import { useMemo, useState, useSyncExternalStore } from 'react'
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
  type UniqueIdentifier,
} from '@dnd-kit/core'
import {
  SortableContext,
  arrayMove,
  rectSortingStrategy,
  sortableKeyboardCoordinates,
  useSortable,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { GripHorizontal, RotateCcw } from 'lucide-react'
import { applyOrder, sameOrder } from '@/lib/order'

export type SortableItem = { id: string; label: string; node: React.ReactNode }

function Item({ item }: { item: SortableItem }) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } =
    useSortable({ id: item.id })

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        zIndex: isDragging ? 20 : undefined,
      }}
      className={`group relative ${isDragging ? 'opacity-90 drop-shadow-xl' : ''}`}
    >
      {/* A alça é a única parte que inicia o arraste: cliques no "!" e no texto seguem normais */}
      <button
        ref={setActivatorNodeRef}
        type="button"
        {...attributes}
        {...listeners}
        aria-label={`Reordenar o cartão ${item.label}`}
        title="Arraste para reordenar"
        className="absolute bottom-2 right-3 z-10 cursor-grab touch-none rounded-full p-1 text-subtle opacity-50 transition-opacity duration-200 hover:bg-black/[0.05] hover:opacity-100 focus-visible:opacity-100 group-hover:opacity-100 active:cursor-grabbing"
      >
        <GripHorizontal aria-hidden className="size-4" />
      </button>
      {/* O cartão ocupa a altura toda da célula, para os cartões da fileira ficarem iguais */}
      <div className="h-full [&>*]:h-full">{item.node}</div>
    </div>
  )
}

const CHANGE_EVENT = 'sortable-cards:change'

// A ordem salva é lida como um "armazenamento externo": no servidor vale a ordem padrão e,
// no navegador, a salva, sem divergência na hidratação.
function useSavedOrder(storageKey: string, defaultKey: string) {
  const raw = useSyncExternalStore(
    (onChange) => {
      window.addEventListener('storage', onChange)
      window.addEventListener(CHANGE_EVENT, onChange)
      return () => {
        window.removeEventListener('storage', onChange)
        window.removeEventListener(CHANGE_EVENT, onChange)
      }
    },
    () => {
      try {
        return window.localStorage.getItem(storageKey) ?? ''
      } catch {
        return ''
      }
    },
    () => '',
  )

  return useMemo(() => {
    const ids = defaultKey.split('|')
    try {
      return raw ? applyOrder(ids, JSON.parse(raw)) : ids
    } catch {
      return ids
    }
  }, [raw, defaultKey])
}

// Grade de cartões que o usuário pode reorganizar arrastando (mouse, toque ou teclado).
// A ordem fica salva neste navegador.
export function SortableCards({
  storageKey,
  dndId,
  items,
  className,
}: {
  storageKey: string
  /** Id estável do contexto de arraste, para a renderização no servidor e no navegador coincidirem. */
  dndId: string
  items: SortableItem[]
  className?: string
}) {
  const defaultKey = items.map((i) => i.id).join('|')
  const saved = useSavedOrder(storageKey, defaultKey)
  // Se o navegador não deixar gravar (janela privada), a ordem vale só até recarregar.
  const [memory, setMemory] = useState<string[] | null>(null)
  const order = memory ?? saved

  const sensors = useSensors(
    // A distância mínima evita que um clique simples vire arraste.
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const byId = new Map(items.map((i) => [i.id, i]))
  const label = (id: UniqueIdentifier) => byId.get(String(id))?.label ?? String(id)
  const ordered = order.map((id) => byId.get(id)).filter((i): i is SortableItem => Boolean(i))
  const defaultOrder = defaultKey.split('|')
  const changed = !sameOrder(order, defaultOrder)

  function save(next: string[]) {
    try {
      if (sameOrder(next, defaultOrder)) window.localStorage.removeItem(storageKey)
      else window.localStorage.setItem(storageKey, JSON.stringify(next))
      setMemory(null)
      window.dispatchEvent(new Event(CHANGE_EVENT))
    } catch {
      setMemory(next)
    }
  }

  function onDragEnd({ active, over }: DragEndEvent) {
    if (!over || active.id === over.id) return
    const from = order.indexOf(String(active.id))
    const to = order.indexOf(String(over.id))
    if (from < 0 || to < 0) return
    save(arrayMove(order, from, to))
  }

  return (
    <div>
      {changed ? (
        <div className="flex justify-end">
          <button
            type="button"
            onClick={() => save(defaultOrder)}
            className="mb-1 inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium text-muted transition-colors duration-200 hover:bg-black/[0.04] hover:text-navy"
          >
            <RotateCcw aria-hidden className="size-3.5" />
            Restaurar ordem padrão
          </button>
        </div>
      ) : null}

      <DndContext
        id={dndId}
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={onDragEnd}
        accessibility={{
          screenReaderInstructions: {
            draggable:
              'Para reordenar, aperte a barra de espaço, use as setas para mover e aperte a barra de espaço de novo para soltar. Esc cancela.',
          },
          announcements: {
            onDragStart: ({ active }) => `Pegou o cartão ${label(active.id)}.`,
            onDragOver: ({ active, over }) =>
              over ? `${label(active.id)} está sobre a posição de ${label(over.id)}.` : undefined,
            onDragEnd: ({ active, over }) =>
              over
                ? `${label(active.id)} foi solto na posição de ${label(over.id)}.`
                : `${label(active.id)} foi solto.`,
            onDragCancel: ({ active }) =>
              `Reordenação cancelada. ${label(active.id)} voltou à posição original.`,
          },
        }}
      >
        <SortableContext items={ordered.map((i) => i.id)} strategy={rectSortingStrategy}>
          <div className={className}>
            {ordered.map((item) => (
              <Item key={item.id} item={item} />
            ))}
          </div>
        </SortableContext>
      </DndContext>
    </div>
  )
}
