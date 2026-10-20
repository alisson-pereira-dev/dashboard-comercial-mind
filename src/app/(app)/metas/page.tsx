import { Suspense } from 'react'
import { connection } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getMetasDoMes, getVendedores, type Vendedor } from '@/lib/dashboard/queries'
import type { MetasValores } from '@/lib/metas-actions'
import { METRIC_KEYS } from '@/lib/metrics'
import { currentMonthBR } from '@/lib/metrics/period'
import { PageHeader } from '@/components/page-header'
import { MetasForm } from '@/components/metas-form'

const VAZIO = Object.fromEntries(METRIC_KEYS.map((k) => [k, ''])) as MetasValores

type SearchParams = Promise<{ mes?: string; vendedor?: string }>

// Esqueleto mostrado enquanto os dados chegam, com o mesmo formato da tela.
function MetasCarregando() {
  return (
    <main className="w-full space-y-5 px-4 py-6 lg:px-1 lg:py-1" aria-busy="true">
      <header>
        <h1 className="text-[28px] font-bold leading-tight tracking-tight text-navy">Metas comerciais</h1>
        <p className="mt-1 text-sm text-muted">Carregando as metas...</p>
      </header>
      <div className="card h-[180px] animate-pulse" />
      <div className="card h-[520px] animate-pulse" />
    </main>
  )
}

export default function MetasPage({ searchParams }: { searchParams: SearchParams }) {
  return (
    <Suspense fallback={<MetasCarregando />}>
      <MetasContent searchParams={searchParams} />
    </Suspense>
  )
}

async function MetasContent({ searchParams }: { searchParams: SearchParams }) {
  // O mês padrão depende da data de hoje, então a página só renderiza no pedido.
  await connection()
  const params = await searchParams
  const mes = params.mes && /^\d{4}-(0[1-9]|1[0-2])$/.test(params.mes) ? params.mes : currentMonthBR()
  const pedido = params.vendedor ?? null

  const supabase = await createClient()
  let vendedores: Vendedor[] = []
  let vendedorId: string | null = null
  let valores: MetasValores = VAZIO
  let erro: string | undefined
  try {
    // Vendedores e metas juntos: uma ida ao banco em vez de duas em fila. Se o vendedor pedido
    // não existir, as metas são buscadas de novo, agora as gerais.
    const [lista, metas] = await Promise.all([
      getVendedores(supabase),
      getMetasDoMes(supabase, mes, pedido ?? 'clinica'),
    ])
    vendedores = lista
    vendedorId = lista.find((v) => v.id === pedido)?.id ?? null
    valores = pedido && !vendedorId ? await getMetasDoMes(supabase, mes, 'clinica') : metas
  } catch {
    erro = 'Não foi possível carregar as metas deste mês.'
  }

  return (
    <main className="w-full space-y-5 px-4 py-6 lg:px-1 lg:py-1">
      <PageHeader
        title="Metas comerciais"
        subtitle="Defina as metas de faturamento e de cada etapa do funil. Elas alimentam a comparação do dashboard."
      />
      <MetasForm
        // Trocar de mês ou vendedor pela URL recria o formulário com os valores certos.
        key={`${mes}|${vendedorId ?? ''}`}
        vendedores={vendedores}
        mesInicial={mes}
        vendedorInicial={vendedorId}
        valoresIniciais={valores}
        erroInicial={erro}
      />
    </main>
  )
}
