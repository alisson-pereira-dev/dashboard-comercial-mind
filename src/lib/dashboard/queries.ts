import type { SupabaseClient } from '@supabase/supabase-js'
import {
  ETAPAS_CONSULTA_IDS,
  ETAPA_CONSULTA_AGENDADA_ID,
  ETAPA_POS_CONSULTA_ID,
  PIPELINE_FUNIL,
  VALOR_CONSULTA,
} from '@/lib/ghl/config'
import { faturamentoConsultas } from '@/lib/metrics/faturamento'
import { METRIC_KEYS, type MetricKey, type Period } from '@/lib/metrics'

export type Realizado = Record<MetricKey, number> & {
  /** Ganhas (no período) que estão nas etapas Consulta Agendada ou Pós consulta. */
  tratamentosNovos: number
  /** Ganhas (no período) que estão na etapa "Consulta Agendada". */
  fechamentosConsulta: number
  /** Ganhas (no período) que estão na etapa "Pós consulta". */
  fechamentosFollowup: number
  /** Oportunidades que ESTÃO na etapa Pós consulta (pela data da última mudança de etapa). Base da taxa de conversão pós consulta; não confundir com `consultas_novas`. */
  posConsultaN: number
}

export type SyncInfo = {
  status: 'rodando' | 'ok' | 'erro'
  iniciadoEm: string
  finalizadoEm: string | null
  erro: string | null
} | null

export type DashboardData = {
  realizado: Realizado
  metas: Record<MetricKey, number | null>
  ultimoSync: SyncInfo
  ultimoSyncOk: string | null
  temDados: boolean
  /** Registros do período que estavam sem responsável no GHL e foram atribuídos ao vendedor padrão. */
  atribuicaoPadrao: { leads: number; vendas: number }
}

// O banco não tem a função dashboard_resumo na versão que o app espera: as migrations em
// supabase/migrations ainda não foram todas rodadas. Em vez de mostrar números pela regra antiga, a tela
// avisa.
export class BancoDesatualizadoError extends Error {
  constructor() {
    super('O banco de dados está desatualizado: rode as migrations em supabase/migrations.')
    this.name = 'BancoDesatualizadoError'
  }
}

// Versão da função dashboard_resumo que este código espera (migration 20261027000001).
const VERSAO_FUNCAO = 4

export type Vendedor = { id: string; nome: string }

export async function getVendedores(supabase: SupabaseClient): Promise<Vendedor[]> {
  const { data, error } = await supabase
    .from('usuarios')
    .select('id, nome')
    .eq('vendedor', true)
    .eq('ativo', true)
    .order('nome')
  if (error) throw new Error(error.message)
  return data ?? []
}

// Metas cadastradas de um mês para uma pessoa ('clinica' = meta geral). Vazio = sem meta.
export async function getMetasDoMes(
  supabase: SupabaseClient,
  mes: string,
  usuarioId: string,
): Promise<Record<MetricKey, string>> {
  const { data, error } = await supabase
    .from('metas')
    .select('metrica, valor')
    .eq('mes_referencia', `${mes}-01`)
    .eq('usuario_id', usuarioId)
  if (error) throw new Error(error.message)
  const porMetrica = new Map((data ?? []).map((m) => [m.metrica as string, String(Number(m.valor))]))
  return Object.fromEntries(METRIC_KEYS.map((k) => [k, porMetrica.get(k) ?? ''])) as Record<MetricKey, string>
}

type MetaRow = { metrica: string; valor: number | string; mes_referencia: string }

// Meta do período = soma das metas dos meses tocados, cada uma pela fração de dias dentro do período.
function somarMetas(period: Period, rows: MetaRow[]): Record<MetricKey, number | null> {
  const metas = Object.fromEntries(METRIC_KEYS.map((k) => [k, null])) as Record<MetricKey, number | null>
  const pesos = new Map(period.metaPesos.map((p) => [p.mes, p.fracao]))
  for (const m of rows) {
    const key = m.metrica as MetricKey
    const parte = Number(m.valor) * (pesos.get(m.mes_referencia) ?? 0)
    metas[key] = Math.round(((metas[key] ?? 0) + parte) * 100) / 100
  }
  return metas
}

// Resposta da função dashboard_resumo (supabase/migrations/20261027000001).
type Resumo = {
  versao: number
  leads: number
  leads_qualificados: number
  consultas_agendadas: number
  /** Oportunidades na etapa Pós consulta (base da taxa de conversão pós consulta). */
  pos_consulta_n: number
  /** Agendamentos do calendário (não cancelados, criado_em no período): base do "Em consultas". */
  faturamento_agendadas: number
  comparecimentos: number
  vendas: number
  vendas_valor: number | string
  vendas_padrao: number
  leads_padrao: number
  consultas_n: number
  consultas_ganhas: number
  fechamentos_consulta: number
  fechamentos_followup: number
  tem_dados: boolean
  metas: MetaRow[]
  ultimo_sync: { status: 'rodando' | 'ok' | 'erro'; iniciado_em: string; finalizado_em: string | null; erro: string | null } | null
  ultimo_sync_ok: string | null
}

// vendedorId = null mostra a clínica toda e usa as metas gerais (usuario_id = 'clinica').
// Uma única ida ao banco (função dashboard_resumo), que aplica a base de data de cada etapa:
// leads e qualificados pelo "criado em"; consultas agendadas (card do funil) pela última mudança de etapa;
// comparecimentos pela atualização do agendamento; vendas pela data em que foram marcadas como ganhas.
// O faturamento em consultas usa um número PRÓPRIO (`faturamento_agendadas`), independente do card
// "Consultas agendadas": volta a contar pelo calendário do GHL (decisão de 26/10/2026, "Etapa 1").
export async function getDashboardData(
  supabase: SupabaseClient,
  period: Period,
  vendedorId: string | null = null,
): Promise<DashboardData> {
  const { data, error } = await supabase.rpc('dashboard_resumo', {
    p_inicio: period.fromIso,
    p_fim: period.toIso,
    p_vendedor: vendedorId,
    p_pipeline: PIPELINE_FUNIL,
    p_etapas: ETAPAS_CONSULTA_IDS,
    p_etapa_consulta: ETAPA_CONSULTA_AGENDADA_ID,
    p_etapa_followup: ETAPA_POS_CONSULTA_ID,
    p_meses: period.metaPesos.map((p) => p.mes),
  })
  // PGRST202 = função com esses argumentos não encontrada: migrations por rodar.
  if (error?.code === 'PGRST202') throw new BancoDesatualizadoError()
  if (error) throw new Error(error.message)
  const r = data as Resumo | null
  if (!r || r.versao !== VERSAO_FUNCAO) throw new BancoDesatualizadoError()

  const consultasValor = faturamentoConsultas(r.faturamento_agendadas, r.comparecimentos, VALOR_CONSULTA)
  const tratamentoValor = Number(r.vendas_valor)
  const s = r.ultimo_sync
  return {
    realizado: {
      leads: r.leads,
      leads_qualificados: r.leads_qualificados,
      consultas_agendadas: r.consultas_agendadas,
      comparecimentos: r.comparecimentos,
      vendas: r.vendas,
      faturamento_consultas: consultasValor,
      faturamento_tratamentos: tratamentoValor,
      faturamento_total: consultasValor + tratamentoValor,
      consultas_novas: r.consultas_n,
      tratamentosNovos: r.consultas_ganhas,
      fechamentosConsulta: r.fechamentos_consulta,
      fechamentosFollowup: r.fechamentos_followup,
      posConsultaN: r.pos_consulta_n,
    },
    metas: somarMetas(period, r.metas),
    ultimoSync: s
      ? { status: s.status, iniciadoEm: s.iniciado_em, finalizadoEm: s.finalizado_em, erro: s.erro }
      : null,
    ultimoSyncOk: r.ultimo_sync_ok,
    temDados: r.tem_dados,
    atribuicaoPadrao: { leads: r.leads_padrao, vendas: r.vendas_padrao },
  }
}
