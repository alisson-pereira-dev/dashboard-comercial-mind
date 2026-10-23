import { Suspense } from 'react'
import { connection } from 'next/server'
import { BarChart3, CalendarDays, CalendarPlus, FilePlus2, FileText, Filter, Users } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { getDashboardData, getVendedores } from '@/lib/dashboard/queries'
import type { DashboardData } from '@/lib/dashboard/queries'
import { VENDEDOR_PADRAO_ID } from '@/lib/ghl/config'
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
import { formatDateTime, formatInt, periodLabel } from '@/lib/format'
import { GoalCard, CountCard } from '@/components/goal-card'
import { GoalFunnels } from '@/components/goal-funnels'
import { RateCard } from '@/components/rate-card'
import { PageHeader } from '@/components/page-header'
import { SyncButton } from '@/components/sync-button'
import { SortableCards } from '@/components/sortable-cards'
import { PeriodFilter } from '@/components/period-filter'
import { VendedorTabs } from '@/components/vendedor-tabs'

// Dois períodos independentes na URL:
// meta_* para Faturamento e Realizado vs. metas, vendas_* para Taxas e Números de vendas.
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

const TRATAMENTO_AVISO =
  'Sem data de início de tratamento no GHL, as vendas deste período estão contabilizadas como consultas novas.'

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
  const periodMeta = parsePeriod({
    mes: one(params.meta_mes),
    de: one(params.meta_de),
    ate: one(params.meta_ate),
  })
  const periodVendas = parsePeriod({
    mes: one(params.vendas_mes),
    de: one(params.vendas_de),
    ate: one(params.vendas_ate),
  })
  const hoje = todayBR()

  const supabase = await createClient()
  let dataMeta, dataVendas, vendedores, vendedorId: string | null
  try {
    const mesmoPeriodo =
      periodMeta.fromIso === periodVendas.fromIso && periodMeta.toIso === periodVendas.toIso
    const pedido = one(params.vendedor) ?? null
    // Tudo em paralelo, já usando o vendedor pedido. Se o id não for de um vendedor conhecido,
    // os números são refeitos sem filtro logo abaixo.
    const carregar = (v: string | null) =>
      Promise.all([
        getDashboardData(supabase, periodMeta, v),
        mesmoPeriodo ? null : getDashboardData(supabase, periodVendas, v),
      ])
    const [lista, [meta, vendas]] = await Promise.all([getVendedores(supabase), carregar(pedido)])
    vendedores = lista
    vendedorId = lista.find((v) => v.id === pedido)?.id ?? null
    if (pedido && !vendedorId) {
      const [metaSemFiltro, vendasSemFiltro] = await carregar(null)
      dataMeta = metaSemFiltro
      dataVendas = vendasSemFiltro ?? metaSemFiltro
    } else {
      dataMeta = meta
      dataVendas = vendas ?? meta
    }
  } catch {
    return (
      <main className="w-full space-y-5 px-4 py-6 lg:px-1 lg:py-1">
        <PageHeader title="Dashboard comercial" />
        <p role="alert" className="card p-6 text-status-abaixo">
          Não foi possível carregar os números. Tente de novo em instantes.
        </p>
      </main>
    )
  }

  const { ultimoSync, ultimoSyncOk, temDados } = dataMeta
  const vendedorNome = vendedores.find((v) => v.id === vendedorId)?.nome ?? null
  const padraoNome = vendedores.find((v) => v.id === VENDEDOR_PADRAO_ID)?.nome ?? null
  const tabs = [
    { id: null, label: 'Clínica toda', href: hrefWith('/', params, 'vendedor', null) },
    ...vendedores.map((v) => ({ id: v.id, label: v.nome, href: hrefWith('/', params, 'vendedor', v.id) })),
  ]

  // Bloco A (período meta_*): faturamento e funis
  const a = dataMeta.realizado
  // Quando o faturamento está zerado por falta de dado no GHL, a tela diz o motivo.
  const fat = dataMeta.faturamento
  const avisosFaturamento: string[] = []
  if (temDados && a.comparecimentos === 0) {
    avisosFaturamento.push(
      'Faturamento em consultas soma o valor da oportunidade dos agendamentos marcados como "compareceu" no calendário do GHL. Nenhum agendamento está marcado assim neste período.',
    )
  }
  if (!fat.tratamentoDisponivel) {
    avisosFaturamento.push(
      'Faturamento em tratamentos indisponível: o banco ainda não tem o campo Valor do tratamento (rodar a migration valor_tratamento e clicar em Atualizar dados).',
    )
  } else if (temDados && fat.oportunidadesComValorTratamento === 0) {
    avisosFaturamento.push(
      'Faturamento em tratamentos soma o campo Valor do tratamento das oportunidades. Nenhuma oportunidade criada neste período tem esse campo preenchido no GHL.',
    )
  }
  const metasA = dataMeta.metas
  const ratesA = funnelRates({
    leads: a.leads,
    leadsQualificados: a.leads_qualificados,
    consultasAgendadas: a.consultas_agendadas,
    comparecimentos: a.comparecimentos,
    vendas: a.vendas,
  })
  const idealRates = funnelRatesFromGoals(metasA)

  // Bloco B (período vendas_*): taxas e números de vendas
  const b = dataVendas.realizado
  const metasB = dataVendas.metas
  const ratesB = funnelRates({
    leads: b.leads,
    leadsQualificados: b.leads_qualificados,
    consultasAgendadas: b.consultas_agendadas,
    comparecimentos: b.comparecimentos,
    vendas: b.vendas,
  })

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
          prefix="meta_"
          kind={periodMeta.kind}
          de={periodMeta.de}
          ate={periodMeta.ate}
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
      {vendedorNome ? <AtribuicaoNota data={dataMeta} period={periodMeta} nome={vendedorNome} /> : null}

      <section className="card p-5 sm:p-6" aria-labelledby="faturamento-titulo">
        <SectionHeader
          id="faturamento-titulo"
          title="Faturamento"
          subtitle={`Resultado financeiro de ${periodLabel(periodMeta)}${vendedorNome ? ` (${vendedorNome})` : ''}.`}
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
                  <GoalCard
                    icon={CalendarDays}
                    label="Em consultas"
                    info={METRIC_HELP.faturamento_consultas}
                    realizado={a.faturamento_consultas}
                    meta={metasA.faturamento_consultas}
                    money
                  />
                ),
              },
              {
                id: 'tratamentos',
                label: 'Em tratamentos',
                node: (
                  <GoalCard
                    icon={FileText}
                    label="Em tratamentos"
                    info={METRIC_HELP.faturamento_tratamentos}
                    realizado={a.faturamento_tratamentos}
                    meta={metasA.faturamento_tratamentos}
                    money
                  />
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
                    meta={metasA.faturamento_total}
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

      <section className="card p-5 sm:p-6" aria-labelledby="realizado-titulo">
        <SectionHeader
          id="realizado-titulo"
          title="Realizado vs. metas"
          subtitle={`Compare cada etapa do realizado com a meta de ${periodLabel(periodMeta)}.`}
        />
        {temDados && a.consultas_agendadas > 0 && a.comparecimentos === 0 ? (
          <div className="mt-4">
            <Notice>
              Nenhum agendamento está com status de comparecimento no calendário do GHL. A taxa de
              comparecimento depende de a equipe marcar esse status.
            </Notice>
          </div>
        ) : null}
        <div className="mt-6">
          <GoalFunnels
            rates={ratesA}
            idealRates={idealRates}
            stages={[
              { key: 'leads', label: 'Leads', help: METRIC_HELP.leads, value: a.leads, meta: metasA.leads },
              {
                key: 'leads_qualificados',
                label: 'Leads qualificados',
                help: METRIC_HELP.leads_qualificados,
                value: a.leads_qualificados,
                meta: metasA.leads_qualificados,
              },
              {
                key: 'consultas_agendadas',
                label: 'Consultas agendadas',
                help: METRIC_HELP.consultas_agendadas,
                value: a.consultas_agendadas,
                meta: metasA.consultas_agendadas,
              },
              {
                key: 'comparecimentos',
                label: 'Comparecimentos',
                help: METRIC_HELP.comparecimentos,
                value: a.comparecimentos,
                meta: metasA.comparecimentos,
              },
              { key: 'vendas', label: 'Vendas', help: METRIC_HELP.vendas, value: a.vendas, meta: metasA.vendas },
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
          filter={
            <PeriodFilter
              prefix="vendas_"
              kind={periodVendas.kind}
              de={periodVendas.de}
              ate={periodVendas.ate}
              hoje={hoje}
            />
          }
        />
        {/* Cinco cartões numa linha em telas largas; abaixo disso, duas colunas e depois uma */}
        <div className="grid gap-4 xl:grid-cols-2 2xl:grid-cols-5">
          <RateCard
            icon={Filter}
            label="Taxa de qualificação"
            help={EXTRA_HELP.qualificacao}
            value={ratesB.qualificacao}
            from="Leads"
            to="Leads qualificados"
            caption={`${plural(b.leads_qualificados, 'qualificado', 'qualificados')} / ${plural(b.leads, 'lead', 'leads')}`}
          />
          <RateCard
            icon={CalendarDays}
            label="Taxa de agendamento de MQL"
            help={EXTRA_HELP.agendamento}
            value={ratesB.agendamento}
            from="Leads qualificados"
            to="Consultas agendadas"
            caption={`${plural(b.consultas_agendadas, 'agendamento', 'agendamentos')} / ${plural(b.leads_qualificados, 'qualificado', 'qualificados')}`}
          />
          <RateCard
            icon={CalendarPlus}
            label="Taxa de agendamento de leads"
            help={EXTRA_HELP.agendamentoLead}
            value={ratesB.agendamentoLead}
            from="Leads"
            to="Consultas agendadas"
            caption={`${plural(b.consultas_agendadas, 'agendamento', 'agendamentos')} / ${plural(b.leads, 'lead', 'leads')}`}
          />
          <RateCard
            icon={Users}
            label="Taxa de comparecimento"
            help={EXTRA_HELP.comparecimento}
            value={ratesB.comparecimento}
            from="Consultas agendadas"
            to="Comparecimentos"
            caption={`${plural(b.comparecimentos, 'comparecimento', 'comparecimentos')} / ${plural(b.consultas_agendadas, 'agendamento', 'agendamentos')}`}
          />
          <RateCard
            icon={FilePlus2}
            label="Taxa de conversão na consulta"
            help={EXTRA_HELP.conversaoConsulta}
            value={ratesB.conversaoConsulta}
            from="Comparecimentos"
            to="Vendas"
            caption={`${plural(b.vendas, 'venda', 'vendas')} / ${plural(b.comparecimentos, 'comparecimento', 'comparecimentos')}`}
          />
        </div>
        <p className="text-xs text-muted">Taxa não calculável (mostrada como hífen) quando a etapa de origem tem zero registros.</p>
      </section>

      <section aria-labelledby="numeros-titulo" className="space-y-4">
        <SectionHeader
          id="numeros-titulo"
          title="Números de vendas"
          subtitle={`Resultados registrados em ${periodLabel(periodVendas)}${vendedorNome ? ` (${vendedorNome})` : ''}.`}
        />
        {vendedorNome ? <AtribuicaoNota data={dataVendas} period={periodVendas} nome={vendedorNome} /> : null}
        <div className="grid gap-4 md:grid-cols-3">
          <GoalCard
            standalone
            icon={BarChart3}
            label="Vendas"
            info={METRIC_HELP.vendas}
            realizado={b.vendas}
            meta={metasB.vendas}
          />
          <GoalCard
            standalone
            icon={CalendarDays}
            label="Consultas novas"
            info={METRIC_HELP.consultas_novas}
            realizado={b.consultas_novas}
            meta={metasB.consultas_novas}
          />
          <CountCard
            icon={FilePlus2}
            label="Tratamentos novos"
            info={EXTRA_HELP.tratamentosNovos}
            value={b.tratamentosNovos}
          />
        </div>
        {temDados && b.vendas > 0 && b.tratamentosNovos === 0 ? <Notice>{TRATAMENTO_AVISO}</Notice> : null}
      </section>
    </main>
  )
}
