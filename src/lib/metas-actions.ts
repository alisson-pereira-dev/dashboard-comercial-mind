'use server'

import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { getMetasDoMes, getVendedores } from '@/lib/dashboard/queries'
import { METRIC_KEYS, type MetricKey } from '@/lib/metrics'

const mesSchema = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/)

export type MetasValores = Record<MetricKey, string>
export type LoadResult = { ok: true; valores: MetasValores } | { ok: false; erro: string }
export type SaveResult = { ok: true } | { ok: false; erro: string }

const SESSAO_EXPIROU = 'Sua sessão expirou. Entre de novo.'

// Confere o login e, quando há vendedor, se ele existe. 'clinica' é a meta geral.
async function contexto(vendedorId: string | null) {
  const supabase = await createClient()
  // getClaims confere a assinatura do token no próprio servidor, sem ir ao Supabase Auth
  // (o proxy já validou a sessão). O RLS continua valendo em todas as consultas.
  const { data: auth } = await supabase.auth.getClaims()
  if (!auth?.claims) return { ok: false as const, erro: SESSAO_EXPIROU }
  if (vendedorId) {
    const vendedores = await getVendedores(supabase)
    if (!vendedores.some((v) => v.id === vendedorId)) return { ok: false as const, erro: 'Vendedor inválido.' }
  }
  return { ok: true as const, supabase, usuarioId: vendedorId ?? 'clinica' }
}

// Metas já cadastradas de um mês, para preencher o formulário. Vazio = sem meta.
export async function loadMetas(mes: string, vendedorId: string | null): Promise<LoadResult> {
  if (!mesSchema.safeParse(mes).success) return { ok: false, erro: 'Escolha um mês válido.' }
  try {
    const ctx = await contexto(vendedorId)
    if (!ctx.ok) return { ok: false, erro: ctx.erro }

    const valores = await getMetasDoMes(ctx.supabase, mes, ctx.usuarioId)
    return { ok: true, valores }
  } catch {
    return { ok: false, erro: 'Não foi possível carregar as metas deste mês.' }
  }
}

// Salva as metas de um mês. Campo em branco remove a meta daquele número.
export async function saveMetas(input: {
  mes: string
  vendedorId: string | null
  valores: Partial<Record<string, string>>
}): Promise<SaveResult> {
  if (!mesSchema.safeParse(input.mes).success) return { ok: false, erro: 'Escolha um mês válido.' }
  const mesReferencia = `${input.mes}-01`

  const gravar: { metrica: MetricKey; valor: number }[] = []
  const apagar: MetricKey[] = []
  for (const metrica of METRIC_KEYS) {
    const raw = String(input.valores[metrica] ?? '')
      .trim()
      .replace(',', '.')
    if (raw === '') {
      apagar.push(metrica)
      continue
    }
    const valor = Number(raw)
    if (!Number.isFinite(valor) || valor < 0) {
      return { ok: false, erro: 'Use apenas números maiores ou iguais a zero.' }
    }
    gravar.push({ metrica, valor })
  }

  try {
    const ctx = await contexto(input.vendedorId)
    if (!ctx.ok) return { ok: false, erro: ctx.erro }

    if (gravar.length > 0) {
      const { error } = await ctx.supabase.from('metas').upsert(
        gravar.map((m) => ({ ...m, mes_referencia: mesReferencia, usuario_id: ctx.usuarioId })),
        { onConflict: 'metrica,mes_referencia,usuario_id' },
      )
      if (error) return { ok: false, erro: 'Não foi possível salvar as metas. Tente de novo.' }
    }
    if (apagar.length > 0) {
      const { error } = await ctx.supabase
        .from('metas')
        .delete()
        .eq('mes_referencia', mesReferencia)
        .eq('usuario_id', ctx.usuarioId)
        .in('metrica', apagar)
      if (error) return { ok: false, erro: 'Não foi possível salvar as metas. Tente de novo.' }
    }
    return { ok: true }
  } catch {
    return { ok: false, erro: 'Não foi possível salvar as metas. Tente de novo.' }
  }
}
