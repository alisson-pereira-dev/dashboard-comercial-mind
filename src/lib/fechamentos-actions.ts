'use server'

import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { PIPELINE_FUNIL } from '@/lib/ghl/config'
import { montarTratamentos, type OportunidadeRow, type TratamentoLinha } from '@/lib/tratamentos'

const entrada = z.object({
  inicio: z.string().datetime({ offset: true }),
  fim: z.string().datetime({ offset: true }),
  vendedorId: z.string().min(1).max(64).nullable(),
  etapaId: z.string().min(1),
})

export type FechamentosResultado =
  | { ok: true; tratamentos: TratamentoLinha[]; total: number }
  | { ok: false; erro: string }

const DIA_MS = 86_400_000

// Oportunidades que formam os cartões "Fechamentos em consulta" e "Fechamentos em follow up": as MESMAS
// que o cartão conta (ganhas do pipeline do funil, na etapa escolhida, marcadas como ganhas no período) e,
// com vendedor, do responsável escolhido. É o mesmo filtro usado na função dashboard_resumo para
// fechamentos_consulta/fechamentos_followup, só que linha a linha. Roda com a sessão de quem está logado,
// então o RLS continua valendo.
export async function listarFechamentos(input: {
  inicio: string
  fim: string
  vendedorId: string | null
  etapaId: string
}): Promise<FechamentosResultado> {
  const p = entrada.safeParse(input)
  if (!p.success) return { ok: false, erro: 'Período inválido.' }
  const { inicio, fim, vendedorId, etapaId } = p.data
  const dias = (Date.parse(fim) - Date.parse(inicio)) / DIA_MS
  if (!(dias > 0) || dias > 400) return { ok: false, erro: 'Período inválido.' }

  try {
    const supabase = await createClient()
    // Mesma checagem de login do restante do app: confere a assinatura do token, sem ir ao Supabase Auth.
    const { data: auth } = await supabase.auth.getClaims()
    if (!auth?.claims) return { ok: false, erro: 'Sua sessão expirou. Entre de novo.' }

    let q = supabase
      .from('oportunidades')
      .select('id, contato_id, valor, criado_em, fechado_em')
      .eq('status', 'ganha')
      .eq('pipeline_nome', PIPELINE_FUNIL)
      .eq('estagio_id', etapaId)
      .gte('fechado_em', inicio)
      .lt('fechado_em', fim)
      .order('fechado_em', { ascending: true })
      .limit(1000)
    if (vendedorId) q = q.eq('responsavel_id', vendedorId)
    const { data: linhas, error } = await q
    if (error) return { ok: false, erro: 'Não foi possível carregar os fechamentos.' }

    const oportunidades = (linhas ?? []) as OportunidadeRow[]
    const ids = [...new Set(oportunidades.map((o) => o.contato_id).filter((c): c is string => Boolean(c)))]
    const nomes = new Map<string, string | null>()
    for (let i = 0; i < ids.length; i += 100) {
      const { data, error: e } = await supabase.from('contatos').select('id, nome').in('id', ids.slice(i, i + 100))
      if (e) return { ok: false, erro: 'Não foi possível carregar os nomes dos pacientes.' }
      for (const c of data ?? []) nomes.set(c.id, c.nome)
    }

    const { tratamentos, total } = montarTratamentos(oportunidades, nomes)
    return { ok: true, tratamentos, total }
  } catch {
    return { ok: false, erro: 'Não foi possível carregar os fechamentos.' }
  }
}
