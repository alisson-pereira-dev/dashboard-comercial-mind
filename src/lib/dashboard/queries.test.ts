import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { parsePeriod } from '@/lib/metrics/period'

// Saída real da função dashboard_resumo (out/2026, clínica toda), tirada de uma cópia dos dados.
const RESUMO = {
  versao: 4,
  leads: 121,
  leads_qualificados: 8,
  consultas_agendadas: 8,
  pos_consulta_n: 3,
  faturamento_agendadas: 2,
  comparecimentos: 0,
  vendas: 0,
  vendas_valor: 0,
  vendas_padrao: 0,
  leads_padrao: 0,
  consultas_n: 9,
  consultas_ganhas: 0,
  fechamentos_consulta: 0,
  fechamentos_followup: 0,
  tem_dados: true,
  metas: [
    { metrica: 'leads', valor: 130.0, mes_referencia: '2026-10-01' },
    { metrica: 'faturamento_consultas', valor: 3000.0, mes_referencia: '2026-10-01' },
  ],
  ultimo_sync: {
    status: 'ok',
    iniciado_em: '2026-10-23T17:00:18.31904+00:00',
    finalizado_em: '2026-10-23T17:01:07.215+00:00',
    erro: null,
  },
  ultimo_sync_ok: '2026-10-23T17:01:07.215+00:00',
}

// getDashboardData guarda em memória que a função não existe: cada teste importa o módulo limpo.
async function carregar() {
  vi.resetModules()
  return (await import('./queries')).getDashboardData
}

const periodo = parsePeriod({ mes: '2026-10' })

describe('getDashboardData com a função dashboard_resumo', () => {
  beforeEach(() => vi.resetModules())

  it('faz uma única chamada ao banco e monta os números do painel', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: RESUMO, error: null })
    const from = vi.fn(() => {
      throw new Error('não deveria consultar tabelas')
    })
    const getDashboardData = await carregar()
    const d = await getDashboardData({ rpc, from } as unknown as SupabaseClient, periodo, null)

    expect(rpc).toHaveBeenCalledTimes(1)
    expect(from).not.toHaveBeenCalled()
    expect(rpc.mock.calls[0][0]).toBe('dashboard_resumo')
    expect(rpc.mock.calls[0][1]).toMatchObject({
      p_inicio: periodo.fromIso,
      p_fim: periodo.toIso,
      p_vendedor: null,
      p_pipeline: 'Qualificação ( IA )',
      p_etapa_consulta: '68bce141-2351-477d-9b92-1fc3cf846650',
      p_etapa_followup: 'aed1d454-d7e3-45d5-8d81-ead7f452c3b8',
      p_meses: ['2026-10-01'],
    })

    // 2 consultas agendadas, nenhuma comparecida: 2 x R$ 160
    expect(d.realizado).toMatchObject({
      leads: 121,
      leads_qualificados: 8,
      consultas_agendadas: 8,
      comparecimentos: 0,
      vendas: 0,
      consultas_novas: 9,
      tratamentos_novos: 0,
      fechamentosConsulta: 0,
      fechamentosFollowup: 0,
      posConsultaN: 3,
      faturamento_consultas: 320,
      faturamento_tratamentos: 0,
      faturamento_total: 320,
    })
    expect(d.metas.leads).toBe(130)
    expect(d.metas.faturamento_consultas).toBe(3000)
    expect(d.metas.vendas).toBeNull()
    expect(d.temDados).toBe(true)
    expect(d.ultimoSyncOk).toBe('2026-10-23T17:01:07.215+00:00')
    expect(d.ultimoSync).toEqual({
      status: 'ok',
      iniciadoEm: '2026-10-23T17:00:18.31904+00:00',
      finalizadoEm: '2026-10-23T17:01:07.215+00:00',
      erro: null,
    })
  })

  it('consulta comparecida vale R$ 320 no lugar de R$ 160; tratamentos vêm das ganhas; o total soma os dois', async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: { ...RESUMO, faturamento_agendadas: 10, comparecimentos: 4, vendas: 3, vendas_valor: 17010 },
      error: null,
    })
    const getDashboardData = await carregar()
    const d = await getDashboardData({ rpc } as unknown as SupabaseClient, periodo, null)
    // 6 agendadas x 160 + 4 comparecidas x 320
    expect(d.realizado.faturamento_consultas).toBe(2240)
    // Em tratamentos: valor das oportunidades ganhas (3 x R$ 5.670)
    expect(d.realizado.faturamento_tratamentos).toBe(17010)
    expect(d.realizado.faturamento_total).toBe(2240 + 17010)
  })

  it('fechamentos em consulta e em follow up vêm da função e somam os tratamentos novos', async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: { ...RESUMO, consultas_n: 12, consultas_ganhas: 12, fechamentos_consulta: 8, fechamentos_followup: 4 },
      error: null,
    })
    const getDashboardData = await carregar()
    const d = await getDashboardData({ rpc } as unknown as SupabaseClient, periodo, null)
    expect(d.realizado.fechamentosConsulta).toBe(8)
    expect(d.realizado.fechamentosFollowup).toBe(4)
    expect(d.realizado.fechamentosConsulta + d.realizado.fechamentosFollowup).toBe(d.realizado.tratamentos_novos)
  })

  it('repassa o vendedor escolhido para a função', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: RESUMO, error: null })
    const getDashboardData = await carregar()
    await getDashboardData({ rpc } as unknown as SupabaseClient, periodo, 'FJ57')
    expect(rpc.mock.calls[0][1]).toMatchObject({ p_vendedor: 'FJ57' })
  })

  it('o período que cruza dois meses pesa as metas de cada um pela fração de dias', async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: {
        ...RESUMO,
        metas: [
          { metrica: 'leads', valor: 100, mes_referencia: '2026-09-01' },
          { metrica: 'leads', valor: 300, mes_referencia: '2026-10-01' },
        ],
      },
      error: null,
    })
    const getDashboardData = await carregar()
    const p = parsePeriod({ de: '2026-09-16', ate: '2026-10-15' })
    const d = await getDashboardData({ rpc } as unknown as SupabaseClient, p, null)
    const pesos = new Map(p.metaPesos.map((x) => [x.mes, x.fracao]))
    const esperado = Math.round((100 * (pesos.get('2026-09-01') ?? 0) + 300 * (pesos.get('2026-10-01') ?? 0)) * 100) / 100
    expect(d.metas.leads).toBe(esperado)
    expect(d.metas.leads).toBeGreaterThan(0)
  })
})

describe('getDashboardData com o banco desatualizado', () => {
  it('versão anterior da função (sem "versao") não vira número pela regra antiga: avisa', async () => {
    const { versao: _removida, faturamento_agendadas: _fa, pos_consulta_n: _pc, ...antiga } = RESUMO
    void _removida
    void _fa
    void _pc
    const rpc = vi.fn().mockResolvedValue({ data: antiga, error: null })
    const getDashboardData = await carregar()
    await expect(getDashboardData({ rpc } as unknown as SupabaseClient, periodo, null)).rejects.toMatchObject({
      name: 'BancoDesatualizadoError',
    })
  })

  it('versão de função diferente da esperada também avisa', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: { ...RESUMO, versao: 1 }, error: null })
    const getDashboardData = await carregar()
    await expect(getDashboardData({ rpc } as unknown as SupabaseClient, periodo, null)).rejects.toMatchObject({
      name: 'BancoDesatualizadoError',
    })
  })

  it('função não encontrada (PGRST202, migration por rodar) avisa que o banco está desatualizado', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: null, error: { code: 'PGRST202', message: 'função não encontrada' } })
    const getDashboardData = await carregar()
    await expect(getDashboardData({ rpc } as unknown as SupabaseClient, periodo, null)).rejects.toMatchObject({
      name: 'BancoDesatualizadoError',
    })
  })

  it('outro erro do banco vira erro comum, sem o aviso de migration', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: null, error: { code: '57014', message: 'timeout' } })
    const getDashboardData = await carregar()
    const p = getDashboardData({ rpc } as unknown as SupabaseClient, periodo, null)
    await expect(p).rejects.toThrow('timeout')
    await expect(p).rejects.not.toMatchObject({ name: 'BancoDesatualizadoError' })
  })
})
