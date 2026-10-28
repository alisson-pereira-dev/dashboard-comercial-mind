import { Suspense } from 'react'
import { connection } from 'next/server'
import {
  BarChart3,
  CalendarCheck,
  CalendarDays,
  CalendarPlus,
  FilePlus2,
  FileText,
  Filter,
  MessageCircleReply,
  Users,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { BancoDesatualizadoError, getDashboardData, getVendedores } from '@/lib/dashboard/queries'
import type { DashboardData } from '@/lib/dashboard/queries'
import {
  ETAPA_CONSULTA_AGENDADA_ID,
  ETAPA_POS_CONSULTA_ID,
  VALOR_CONSULTA,
  VENDEDOR_PADRAO_ID,
} from '@/lib/ghl/config'
import { hrefWith } from '@/lib/url'
import {
  EXTRA_HELP,
  METRIC_HELP,
  funnelRates,
  funnelRatesFromGoals,
  parsePeriod,
  todayBR,
} from '@/lib/metrics'
import type { Period } from '@/lib/metrics'
import { formatDateTime, formatInt, formatMoney, periodLabel } from '@/lib/format'
import { GoalCard, CountCard } from '@/components/goal-card'
import { ConsultasDetalhe } from '@/components/consultas-detalhe'
import { TratamentosDetalhe } from '@/components/tratamentos-detalhe'
import { FechamentosDetalhe } from '@/components/fechamentos-detalhe'
import { GoalFunnels } from '@/components/goal-funnels'
import { RateCard } from '@/components/rate-card'
import { DragScrollRow } from '@/components/drag-scroll-row'
import { PageHeader } from '@/components/page-header'
import { SyncButton } from '@/components/sync-button'
import { SortableCards } from '@/components/sortable-cards'
import { PeriodFilter } from '@/components/period-filter'
import { VendedorTabs } from '@/components/vendedor-tabs'

// Um único período na URL (periodo_mes / periodo_de / periodo_ate), usado por todos os blocos.
type SearchParams = Promise<Record<string, string | string[] | undefined>>

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v)

export default function DashboardPage({ searchParams }: { searchParams: SearchParams }) {
  return (
    <Suspense
      fallback={
        <main className="w-full space-y-5 px-4 py-6 lg:px-1 lg:py-1" aria-busy="true">
          <header>
            <h1 className="text-[28px] font-bold leading-tight tracking-tight text-navy">Dashboard comercial</h1>
            <p className="mt-1 text-sm text-muted">Carregando os números...</p>
          </header>
          <div className="card h-[150px] animate-pulse" />
          <div className="card h-[520px] animate-pulse" />
        </main>
      }
    >
      <DashboardContent searchParams={searchParams} />
    </Suspense>
  )
}

function Notice({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-2xl border border-status-na-meta/40 bg-[var(--status-na-meta-bg)] px-5 py-2.5 text-sm text-[var(--status-na-meta-ink)]">
      {children}
    </p>
  )
}

function SectionHeader({
  id,
  title,
  subtitle,
  filter,
}: {
  id: string
  title: string
  subtitle: string
  filter?: React.ReactNode
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div>
        <h2 id={id} className="text-xl font-bold tracking-tight text-navy">
          {title}
        </h2>
        <p className="mt-0.5 text-sm text-muted">{subtitle}</p>
      </div>
      {filter}
    </div>
  )
}

const plural = (n: number, um: string, varios: string) => `${formatInt(n)} ${n === 1 ? um : varios}`

function AtribuicaoNota({
  data,
  period,
  nome,
}: {
  data: DashboardData
  period: Period
  nome: string | null
}) {
  const { leads: leadsPadrao, vendas: vendasPadrao } = data.atribuicaoPadrao
  if (!nome || (leadsPadrao === 0 && vendasPadrao === 0)) return null
  return (
    <p className="text-xs text-muted">
      Em {periodLabel(period)}, {formatInt(leadsPadrao)} de {formatInt(data.realizado.leads)} leads e{' '}
      {formatInt(vendasPadrao)} de {formatInt(data.realizado.vendas)} vendas estavam sem responsável no
      GHL e foram atribuídos a {nome}.
    </p>
  )
}

async function DashboardContent({ searchParams }: { searchParams: SearchParams }) {
  // O período padrão depende da data de hoje, então a página só renderiza no pedido.
  await connection()
  const params = await searchParams
  const period = parsePeriod({
    mes: one(params.periodo_mes),
    de: one(params.periodo_de),
    ate: one(params.periodo_ate),
  })
  const hoje = todayBR()

  const supabase = await createClient()
  let data, vendedores, vendedorId: string | null
  try {
    const pedido = one(params.vendedor) ?? null
    const [lista, meta] = await Promise.all([
      getVendedores(supabase),
      getDashboardData(supabase, period, pedido),
    ])
    vendedores = lista
    vendedorId = lista.find((v) => v.id === pedido)?.id ?? null
    // Se o id pedido não for de um vendedor conhecido, refaz sem filtro.
    data = pedido && !vendedorId ? await getDashboardData(supabase, period, null) : meta
  } catch (e) {
    return (
      <main className="w-full space-y-5 px-4 py-6 lg:px-1 lg:py-1">
        <PageHeader title="Dashboard comercial" />
        <p role="alert" className="card p-6 text-status-abaixo">
          {e instanceof BancoDesatualizadoError
            ? 'O banco de dados está desatualizado em relação ao painel. Peça à equipe Mindsight para rodar as migrations pendentes.'
            : 'Não foi possível carregar os números. Tente de novo em instantes.'}
        </p>
      </main>
    )
  }

  const { ultimoSync, ultimoSyncOk, temDados } = data
  const vendedorNome = vendedores.find((v) => v.id === vendedorId)?.nome ?? null
  const padraoNome = vendedores.find((v) => v.id === VENDEDOR_PADRAO_ID)?.nome ?? null
  const tabs = [
    { id: null, label: 'Clínica toda', href: hrefWith('/', params, 'vendedor', null) },
    ...vendedores.map((v) => ({ id: v.id, label: v.nome, href: hrefWith('/', params, 'vendedor', v.id) })),
  ]

  const a = data.realizado
  // Quando o faturamento está zerado por falta de dado no GHL, a tela diz o motivo.
  const avisosFaturamento: string[] = []
  if (temDados && a.faturamento_consultas === 0) {
    avisosFaturamento.push(
      `Faturamento em consultas vale ${formatMoney(VALOR_CONSULTA.agendada)} por agendamento criado no calendário do GHL e ${formatMoney(VALOR_CONSULTA.comparecida)} por consulta comparecida. Nenhum agendamento foi criado nem comparecido neste período.`,
    )
  }
  if (temDados && a.vendas === 0) {
    avisosFaturamento.push(
      'Faturamento em tratamentos soma o valor das oportunidades marcadas como ganhas. Nenhuma oportunidade foi marcada como ganha neste período.',
    )
  }
  const metas = data.metas
  const rates = funnelRates({
    leads: a.leads,
    leadsQualificados: a.leads_qualificados,
    consultasAgendadas: a.consultas_agendadas,
    comparecimentos: a.comparecimentos,
    vendas: a.vendas,
    fechamentosConsulta: a.fechamentosConsulta,
    fechamentosFollowup: a.fechamentosFollowup,
    posConsultaN: a.posConsultaN,
  })
  const idealRates = funnelRatesFromGoals(metas)

  return (
    <main className="w-full space-y-5 px-4 py-6 lg:px-1 lg:py-1">
      <PageHeader
        title="Dashboard comercial"
        subtitle={
          ultimoSyncOk
            ? `Dados atualizados em ${formatDateTime(ultimoSyncOk)}`
            : 'Os dados ainda não foram atualizados.'
        }
        actions={<SyncButton />}
      />

      <div className="flex flex-wrap items-start justify-between gap-4">
        <VendedorTabs
          tabs={tabs}
          selected={vendedorId}
          note={
            padraoNome
              ? `Registros sem responsável no GHL contam para ${padraoNome}.`
              : undefined
          }
        />
        <PeriodFilter
          prefix="periodo_"
          kind={period.kind}
          de={period.de}
          ate={period.ate}
          hoje={hoje}
        />
      </div>

      {ultimoSync?.status === 'erro' ? (
        <p role="alert" className="text-sm text-status-abaixo">
          A última atualização falhou: {ultimoSync.erro ?? 'erro desconhecido'}.
        </p>
      ) : null}
      {!temDados ? (
        <Notice>Ainda não há dados. Clique em Atualizar dados para buscar as informações do GHL.</Notice>
      ) : null}
      {vendedorNome ? <AtribuicaoNota data={data} period={period} nome={vendedorNome} /> : null}

      <section className="card p-5 sm:p-6" aria-labelledby="faturamento-titulo">
        <SectionHeader
          id="faturamento-titulo"
          title="Faturamento"
          subtitle={`Resultado financeiro de ${periodLabel(period)}${vendedorNome ? ` (${vendedorNome})` : ''}.`}
        />
        <div className="mt-4">
          <SortableCards
            storageKey="dashboard:ordem:faturamento"
            dndId="faturamento"
            className="grid gap-4 md:grid-cols-3"
            items={[
              {
                id: 'consultas',
                label: 'Em consultas',
                node: (
                  <ConsultasDetalhe
                    inicio={period.fromIso}
                    fim={period.toIso}
                    vendedorId={vendedorId}
                    periodo={periodLabel(period)}
                  >
                    <GoalCard
                      icon={CalendarDays}
                      label="Em consultas"
                      info={METRIC_HELP.faturamento_consultas}
                      realizado={a.faturamento_consultas}
                      meta={metas.faturamento_consultas}
                      money
                      rodape={
                        <button
                          type="button"
                          data-abre-detalhe
                          className="text-sm font-semibold text-brand-ink underline-offset-4 hover:underline"
                        >
                          Ver as consultas
                        </button>
                      }
                    />
                  </ConsultasDetalhe>
                ),
              },
              {
                id: 'tratamentos',
                label: 'Em tratamentos',
                node: (
                  <TratamentosDetalhe
                    inicio={period.fromIso}
                    fim={period.toIso}
                    vendedorId={vendedorId}
                    periodo={periodLabel(period)}
                  >
                    <GoalCard
                      icon={FileText}
                      label="Em tratamentos"
                      info={METRIC_HELP.faturamento_tratamentos}
                      realizado={a.faturamento_tratamentos}
                      meta={metas.faturamento_tratamentos}
                      money
                      rodape={
                        <button
                          type="button"
                          data-abre-detalhe
                          className="text-sm font-semibold text-brand-ink underline-offset-4 hover:underline"
                        >
                          Ver os tratamentos
                        </button>
                      }
                    />
                  </TratamentosDetalhe>
                ),
              },
              {
                id: 'total',
                label: 'Total',
                node: (
                  <GoalCard
                    icon={BarChart3}
                    label="Total"
                    info={METRIC_HELP.faturamento_total}
                    realizado={a.faturamento_total}
                    meta={metas.faturamento_total}
                    money
                    highlight
                  />
                ),
              },
            ]}
          />
        </div>
        {avisosFaturamento.length > 0 ? (
          <div className="mt-4 space-y-2">
            {avisosFaturamento.map((t) => (
              <Notice key={t}>{t}</Notice>
            ))}
          </div>
        ) : null}
      </section>

      <section aria-labelledby="numeros-titulo" className="space-y-4">
        <SectionHeader
          id="numeros-titulo"
          title="Números de vendas"
          subtitle={`Resultados registrados em ${periodLabel(period)}${vendedorNome ? ` (${vendedorNome})` : ''}.`}
        />
        <SortableCards
          storageKey="dashboard:ordem:numeros"
          dndId="numeros"
          className="grid gap-4 md:grid-cols-3 2xl:grid-cols-5"
          items={[
            {
              id: 'vendas',
              label: 'Vendas',
              node: (
                <GoalCard
                  standalone
                  compacto
                  icon={BarChart3}
                  label="Vendas"
                  info={METRIC_HELP.vendas}
                  realizado={a.vendas}
                  meta={metas.vendas}
                />
              ),
            },
            {
              id: 'consultas_novas',
              label: 'Consultas novas',
              node: (
                <GoalCard
                  standalone
                  compacto
                  icon={CalendarDays}
                  label="Consultas novas"
                  info={METRIC_HELP.consultas_novas}
                  realizado={a.consultas_novas}
                  meta={metas.consultas_novas}
                />
              ),
            },
            {
              id: 'tratamentos_novos',
              label: 'Tratamentos novos',
              node: (
                <CountCard
                  icon={FilePlus2}
                  label="Tratamentos novos"
                  info={EXTRA_HELP.tratamentosNovos}
                  value={a.tratamentosNovos}
                />
              ),
            },
            {
              id: 'fechamentos_consulta',
              label: 'Fechamentos em consulta',
              node: (
                <FechamentosDetalhe
                  etapa="consulta"
                  etapaId={ETAPA_CONSULTA_AGENDADA_ID}
                  inicio={period.fromIso}
                  fim={period.toIso}
                  vendedorId={vendedorId}
                  periodo={periodLabel(period)}
                >
                  <CountCard
                    icon={CalendarCheck}
                    label="Fechamentos em consulta"
                    info={EXTRA_HELP.fechamentosConsulta}
                    value={a.fechamentosConsulta}
                    rodape={
                      <button
                        type="button"
                        data-abre-detalhe
                        className="text-sm font-semibold text-brand-ink underline-offset-4 hover:underline"
                      >
                        Ver os fechamentos
                      </button>
                    }
                  />
                </FechamentosDetalhe>
              ),
            },
            {
              id: 'fechamentos_followup',
              label: 'Fechamentos em follow up',
              node: (
                <FechamentosDetalhe
                  etapa="followup"
                  etapaId={ETAPA_POS_CONSULTA_ID}
                  inicio={period.fromIso}
                  fim={period.toIso}
                  vendedorId={vendedorId}
                  periodo={periodLabel(period)}
                >
                  <CountCard
                    icon={MessageCircleReply}
                    label="Fechamentos em follow up"
                    info={EXTRA_HELP.fechamentosFollowup}
                    value={a.fechamentosFollowup}
                    rodape={
                      <button
                        type="button"
                        data-abre-detalhe
                        className="text-sm font-semibold text-brand-ink underline-offset-4 hover:underline"
                      >
                        Ver os fechamentos
                      </button>
                    }
                  />
                </FechamentosDetalhe>
              ),
            },
          ]}
        />
      </section>

      <section className="card p-5 sm:p-6" aria-labelledby="realizado-titulo">
        <SectionHeader
          id="realizado-titulo"
          title="Realizado vs. metas"
          subtitle={`Compare cada etapa do realizado com a meta de ${periodLabel(period)}.`}
        />
        {temDados && a.consultas_agendadas > 0 && a.comparecimentos === 0 ? (
          <div className="mt-4">
            <Notice>
              Nenhum agendamento foi marcado como comparecido no calendário do GHL neste período. A taxa de
              comparecimento depende de a equipe marcar esse status.
            </Notice>
          </div>
        ) : null}
        <div className="mt-6">
          <GoalFunnels
            rates={rates}
            idealRates={idealRates}
            stages={[
              { key: 'leads', label: 'Leads', help: METRIC_HELP.leads, value: a.leads, meta: metas.leads },
              {
                key: 'leads_qualificados',
                label: 'Leads qualificados',
                help: METRIC_HELP.leads_qualificados,
                value: a.leads_qualificados,
                meta: metas.leads_qualificados,
              },
              {
                key: 'consultas_agendadas',
                label: 'Consultas agendadas',
                help: METRIC_HELP.consultas_agendadas,
                value: a.consultas_agendadas,
                meta: metas.consultas_agendadas,
              },
              {
                key: 'comparecimentos',
                label: 'Comparecimentos',
                help: METRIC_HELP.comparecimentos,
                value: a.comparecimentos,
                meta: metas.comparecimentos,
              },
              { key: 'vendas', label: 'Vendas', help: METRIC_HELP.vendas, value: a.vendas, meta: metas.vendas },
            ]}
          />
        </div>
        <p className="mt-6 text-center text-xs text-muted">
          O formato do funil é ilustrativo: a largura não é proporcional aos números. Metas conforme o
          cadastro atual. Taxa não calculável quando a etapa de origem tem zero registros.
        </p>
      </section>

      <section aria-labelledby="taxas-titulo" className="space-y-4">
        <SectionHeader
          id="taxas-titulo"
          title="Taxas de cada etapa do funil"
          subtitle="Entenda como os leads avançam até a venda."
        />
        {/* Faixa que rola na horizontal (arraste com o mouse ou toque); a alça de cada cartão reordena */}
        <DragScrollRow className="pb-2">
          <SortableCards
            storageKey="dashboard:ordem:taxas"
            dndId="taxas"
            layout="horizontal"
            className="flex gap-4"
            items={[
              {
                id: 'qualificacao',
                label: 'Taxa de qualificação',
                node: (
                  <div className="h-full w-[300px] shrink-0 sm:w-[340px] [&>*]:h-full">
                    <RateCard
                      icon={Filter}
                      label="Taxa de qualificação"
                      help={EXTRA_HELP.qualificacao}
                      value={rates.qualificacao}
                      from="Leads"
                      to="Leads qualificados"
                      caption={`${plural(a.leads_qualificados, 'qualificado', 'qualificados')} / ${plural(a.leads, 'lead', 'leads')}`}
                    />
                  </div>
                ),
              },
              {
                id: 'agendamento_mql',
                label: 'Taxa de agendamento de MQL',
                node: (
                  <div className="h-full w-[300px] shrink-0 sm:w-[340px] [&>*]:h-full">
                    <RateCard
                      icon={CalendarDays}
                      label="Taxa de agendamento de MQL"
                      help={EXTRA_HELP.agendamento}
                      value={rates.agendamento}
                      from="Leads qualificados"
                      to="Consultas agendadas"
                      caption={`${plural(a.consultas_agendadas, 'agendamento', 'agendamentos')} / ${plural(a.leads_qualificados, 'qualificado', 'qualificados')}`}
                    />
                  </div>
                ),
              },
              {
                id: 'agendamento_lead',
                label: 'Taxa de agendamento de leads',
                node: (
                  <div className="h-full w-[300px] shrink-0 sm:w-[340px] [&>*]:h-full">
                    <RateCard
                      icon={CalendarPlus}
                      label="Taxa de agendamento de leads"
                      help={EXTRA_HELP.agendamentoLead}
                      value={rates.agendamentoLead}
                      from="Leads"
                      to="Consultas agendadas"
                      caption={`${plural(a.consultas_agendadas, 'agendamento', 'agendamentos')} / ${plural(a.leads, 'lead', 'leads')}`}
                    />
                  </div>
                ),
              },
              {
                id: 'comparecimento',
                label: 'Taxa de comparecimento',
                node: (
                  <div className="h-full w-[300px] shrink-0 sm:w-[340px] [&>*]:h-full">
                    <RateCard
                      icon={Users}
                      label="Taxa de comparecimento"
                      help={EXTRA_HELP.comparecimento}
                      value={rates.comparecimento}
                      from="Consultas agendadas"
                      to="Comparecimentos"
                      caption={`${plural(a.comparecimentos, 'comparecimento', 'comparecimentos')} / ${plural(a.consultas_agendadas, 'agendamento', 'agendamentos')}`}
                    />
                  </div>
                ),
              },
              {
                id: 'conversao_consulta',
                label: 'Taxa de conversão na consulta',
                node: (
                  <div className="h-full w-[300px] shrink-0 sm:w-[340px] [&>*]:h-full">
                    <FechamentosDetalhe
                      etapa="consulta"
                      etapaId={ETAPA_CONSULTA_AGENDADA_ID}
                      inicio={period.fromIso}
                      fim={period.toIso}
                      vendedorId={vendedorId}
                      periodo={periodLabel(period)}
                    >
                      <RateCard
                        icon={FilePlus2}
                        label="Taxa de conversão na consulta"
                        help={EXTRA_HELP.conversaoConsulta}
                        value={rates.conversaoConsulta}
                        from="Consultas agendadas"
                        to="Fechamentos em consulta"
                        caption={`${plural(a.fechamentosConsulta, 'fechamento', 'fechamentos')} / ${plural(a.consultas_agendadas, 'agendamento', 'agendamentos')}`}
                        rodape={
                          <button
                            type="button"
                            data-abre-detalhe
                            className="text-sm font-semibold text-brand-ink underline-offset-4 hover:underline"
                          >
                            Ver os fechamentos
                          </button>
                        }
                      />
                    </FechamentosDetalhe>
                  </div>
                ),
              },
              {
                id: 'conversao_pos_consulta',
                label: 'Taxa de conversão pós consulta',
                node: (
                  <div className="h-full w-[300px] shrink-0 sm:w-[340px] [&>*]:h-full">
                    <FechamentosDetalhe
                      etapa="followup"
                      etapaId={ETAPA_POS_CONSULTA_ID}
                      inicio={period.fromIso}
                      fim={period.toIso}
                      vendedorId={vendedorId}
                      periodo={periodLabel(period)}
                    >
                      <RateCard
                        icon={MessageCircleReply}
                        label="Taxa de conversão pós consulta"
                        help={EXTRA_HELP.conversaoPosConsulta}
                        value={rates.conversaoPosConsulta}
                        from="Pós consulta"
                        to="Fechamentos em follow up"
                        caption={`${plural(a.fechamentosFollowup, 'fechamento', 'fechamentos')} / ${plural(a.posConsultaN, 'oportunidade', 'oportunidades')}`}
                        rodape={
                          <button
                            type="button"
                            data-abre-detalhe
                            className="text-sm font-semibold text-brand-ink underline-offset-4 hover:underline"
                          >
                            Ver os fechamentos
                          </button>
                        }
                      />
                    </FechamentosDetalhe>
                  </div>
                ),
              },
            ]}
          />
        </DragScrollRow>
        <p className="text-xs text-muted">Taxa não calculável (mostrada como hífen) quando a etapa de origem tem zero registros.</p>
      </section>
    </main>
  )
}
