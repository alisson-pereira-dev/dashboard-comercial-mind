'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { RefreshCw } from 'lucide-react'

export function SyncButton() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function sync() {
    if (loading) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/sync', { method: 'POST' })
      const body = (await res.json().catch(() => ({}))) as { erro?: string }
      if (!res.ok) throw new Error(body.erro ?? 'Falha ao atualizar os dados.')
      router.refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Falha ao atualizar os dados.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button type="button" onClick={sync} disabled={loading} className="btn btn-primary">
        <RefreshCw aria-hidden className={`size-4 ${loading ? 'animate-spin' : ''}`} />
        {loading ? 'Atualizando...' : 'Atualizar dados'}
      </button>
      {error ? (
        <p role="alert" className="max-w-xs text-right text-xs text-status-abaixo">
          {error}
        </p>
      ) : null}
    </div>
  )
}
