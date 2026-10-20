import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { runSync } from '@/lib/ghl/sync'

export const maxDuration = 300

const LIMITE_SYNC_PRESO_MS = 10 * 60 * 1000

export async function POST() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return Response.json({ erro: 'Não autorizado.' }, { status: 401 })

  const admin = createAdminClient()

  // Bloqueia sync simultâneo (cliques repetidos no botão).
  const desde = new Date(Date.now() - LIMITE_SYNC_PRESO_MS).toISOString()
  const { data: emAndamento } = await admin
    .from('sync_runs')
    .select('id')
    .eq('status', 'rodando')
    .gte('iniciado_em', desde)
    .limit(1)
  if (emAndamento && emAndamento.length > 0) {
    return Response.json({ erro: 'Já existe uma atualização em andamento.' }, { status: 409 })
  }

  const { data: run, error: runError } = await admin
    .from('sync_runs')
    .insert({})
    .select('id')
    .single()
  if (runError || !run) {
    return Response.json({ erro: 'Não foi possível iniciar a atualização.' }, { status: 500 })
  }

  try {
    const contagens = await runSync(admin)
    await admin
      .from('sync_runs')
      .update({ status: 'ok', finalizado_em: new Date().toISOString(), contagens })
      .eq('id', run.id)
    return Response.json({ ok: true, contagens })
  } catch (e) {
    const mensagem = e instanceof Error ? e.message : 'Erro desconhecido.'
    await admin
      .from('sync_runs')
      .update({ status: 'erro', finalizado_em: new Date().toISOString(), erro: mensagem })
      .eq('id', run.id)
    return Response.json({ erro: mensagem }, { status: 500 })
  }
}
