'use server'

import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { VALOR_CONSULTA } from '@/lib/ghl/config'
import {
  montarConsultas,
  type AgendamentoAgendado,
  type Comparecimento,
  type ConsultaLinha,
} from '@/lib/consultas'

const entrada = z.object({
  inicio: z.string().datetime({ offset: true }),
  fim: z.string().datetime({ offset: true }),
  vendedorId: z.string().min(1).max(64).nullable(),
})

export type ConsultasResultado =
  | { ok: true; consultas: ConsultaLinha[]; total: number; valores: { agendada: number; comparecida: number } }
  | { ok: false; erro: string }

const DIA_MS = 86_400_000

// Linhas que formam o "Em consultas" de um período: as MESMAS que o cartão conta (função dashboard_resumo,
// campo `faturamento_agendadas`): agendamentos do calendário não cancelados criados no período, mais os
// marcados como "compareceu" e atualizados no período (regra de 26/10/2026, de volta ao calendário; ver
// `lib/metrics/faturamento.ts`). Independente do card "Consultas agendadas" do funil, que usa a etapa do
// pipeline. Com vendedor, só os dele. Roda com a sessão de quem está logado, então o RLS continua valendo.
export async function listarConsultas(input: {
  inicio: string
  fim: string
  vendedorId: string | null
}): Promise<ConsultasResultado> {
  const p = entrada.safeParse(input)
  if (!p.success) return { ok: false, erro: 'Período inválido.' }
  const { inicio, fim, vendedorId } = p.data
  const dias = (Date.parse(fim) - Date.parse(inicio)) / DIA_MS
  if (!(dias > 0) || dias > 400) return { ok: false, erro: 'Período inválido.' }

  try {
    const supabase = await createClient()
    // Mesma checagem de login do restante do app: confere a assinatura do token, sem ir ao Supabase Auth.
    const { data: auth } = await supabase.auth.getClaims()
    if (!auth?.claims) return { ok: false, erro: 'Sua sessão expirou. Entre de novo.' }

    let qAgendados = supabase
      .from('agendamentos')
      .select('id, contato_id, data_inicio, criado_em')
      .neq('status', 'cancelado')
      .gte('criado_em', inicio)
      .lt('criado_em', fim)
      .order('criado_em', { ascending: true })
      .limit(1000)
    let qComparecimentos = supabase
      .from('agendamentos')
      .select('id, contato_id, data_inicio, atualizado_em_ghl')
      .eq('status', 'compareceu')
      .gte('atualizado_em_ghl', inicio)
      .lt('atualizado_em_ghl', fim)
      .order('atualizado_em_ghl', { ascending: true })
      .limit(1000)
    if (vendedorId) {
      qAgendados = qAgendados.eq('responsavel_id', vendedorId)
      qComparecimentos = qComparecimentos.eq('responsavel_id', vendedorId)
    }
    const [agendadosRes, comparecimentosRes] = await Promise.all([qAgendados, qComparecimentos])
    if (agendadosRes.error || comparecimentosRes.error) {
      return { ok: false, erro: 'Não foi possível carregar as consultas.' }
    }

    const agendados = (agendadosRes.data ?? []) as AgendamentoAgendado[]
    const comparecimentos = (comparecimentosRes.data ?? []) as Comparecimento[]
    const ids = [
      ...new Set(
        [...agendados, ...comparecimentos].map((r) => r.contato_id).filter((c): c is string => Boolean(c)),
      ),
    ]
    const nomes = new Map<string, string | null>()
    for (let i = 0; i < ids.length; i += 100) {
      const { data, error: e } = await supabase.from('contatos').select('id, nome').in('id', ids.slice(i, i + 100))
      if (e) return { ok: false, erro: 'Não foi possível carregar os nomes dos pacientes.' }
      for (const c of data ?? []) nomes.set(c.id, c.nome)
    }

    const { consultas, total } = montarConsultas(agendados, comparecimentos, nomes, VALOR_CONSULTA)
    return { ok: true, consultas, total, valores: VALOR_CONSULTA }
  } catch {
    return { ok: false, erro: 'Não foi possível carregar as consultas.' }
  }
}
