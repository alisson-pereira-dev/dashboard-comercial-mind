import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { parsePeriod } from '@/lib/metrics/period'

// Saída real da função dashboard_resumo (out/2026, clínica toda), tirada de uma cópia dos dados.
const RESUMO = {
  leads: 121,
  leads_qualificados: 8,
  consultas_agendadas: 2,
  comparecimentos: 0,
  vendas: 0,
  vendas_padrao: 0,
  leads_padrao: 0,
  consultas_n: 9,
  consultas_ganhas: 0,
  consultas_valor: 1760.0,
  tratamento_n: 0,
  tratamento_valor: 0,
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
      p_meses: ['2026-10-01'],
    })

    expect(d.realizado).toMatchObject({
      leads: 121,
      leads_qualificados: 8,
      consultas_agendadas: 2,
      comparecimentos: 0,
      vendas: 0,
      consultas_novas: 9,
      tratamentosNovos: 0,
      faturamento_consultas: 1760,
      faturamento_tratamentos: 0,
      faturamento_total: 1760,
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
    expect(d.faturamento).toEqual({
      tratamentoDisponivel: true,
      oportunidadesComValorTratamento: 0,
      oportunidadesEmConsulta: 9,
    })
  })

  it('o total do faturamento é consultas mais tratamentos', async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: { ...RESUMO, consultas_valor: 6950, tratamento_valor: 5350, tratamento_n: 1 },
      error: null,
    })
    const getDashboardData = await carregar()
    const d = await getDashboardData({ rpc } as unknown as SupabaseClient, periodo, null)
    expect(d.realizado.faturamento_total).toBe(12300)
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

describe('getDashboardData sem a função no banco (migration por rodar)', () => {
  it('cai no caminho antigo e não insiste na função por alguns minutos', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: null, error: { code: 'PGRST202', message: 'função não encontrada' } })
    const from = vi.fn(() => {
      throw new Error('caminho-antigo-chamado')
    })
    const getDashboardData = await carregar()
    const supabase = { rpc, from } as unknown as SupabaseClient

    await expect(getDashboardData(supabase, periodo, null)).rejects.toThrow('caminho-antigo-chamado')
    expect(rpc).toHaveBeenCalledTimes(1)

    // Segunda chamada: não tenta a função de novo.
    await expect(getDashboardData(supabase, periodo, null)).rejects.toThrow('caminho-antigo-chamado')
    expect(rpc).toHaveBeenCalledTimes(1)
  })

  it('outro erro da função também cai no caminho antigo, mas tenta a função de novo na próxima', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: null, error: { code: '57014', message: 'timeout' } })
    const from = vi.fn(() => {
      throw new Error('caminho-antigo-chamado')
    })
    const getDashboardData = await carregar()
    const supabase = { rpc, from } as unknown as SupabaseClient
    await expect(getDashboardData(supabase, periodo, null)).rejects.toThrow('caminho-antigo-chamado')
    await expect(getDashboardData(supabase, periodo, null)).rejects.toThrow('caminho-antigo-chamado')
    expect(rpc).toHaveBeenCalledTimes(2)
  })
})
