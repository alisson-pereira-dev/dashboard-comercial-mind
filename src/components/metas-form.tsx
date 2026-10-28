'use client'

import { useEffect, useRef, useState, useSyncExternalStore, useTransition } from 'react'
import {
  BarChart3,
  CalendarDays,
  CalendarPlus,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  FileText,
  Info,
  Pencil,
  RotateCcw,
} from 'lucide-react'
import { METRIC_KEYS, type MetricKey } from '@/lib/metrics'
import { monthLabel } from '@/lib/format'
import { loadMetas, saveMetas, type MetasValores } from '@/lib/metas-actions'
import {
  editar,
  modoInicial,
  precoConsultaDe,
  taxasDe,
  TAXAS_VAZIAS,
  type Campo,
  type Modo,
  type Taxas,
} from '@/lib/metas-edit'
import { MonthGrid } from './month-grid'
import { SortableCards, type SortableItem } from './sortable-cards'
import { DESTAQUE, MetasFunnel } from './metas-funnel'

type Vendedor = { id: string; nome: string }

const VAZIO = Object.fromEntries(METRIC_KEYS.map((k) => [k, ''])) as MetasValores

function shiftMonth(mes: string, delta: number) {
  const [y, m] = mes.split('-').map(Number)
  const d = new Date(Date.UTC(y, m - 1 + delta, 1))
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`
}

// Cartões do bloco de faturamento. `quantidade` = meta em unidades (sem R$). O usuário pode
// reordená-los por arrastar e soltar (a ordem fica neste navegador).
const FATURAMENTO: {
  chave: MetricKey
  rotulo: string
  Icone: typeof CalendarDays
  destaque?: boolean
  quantidade?: boolean
}[] = [
  { chave: 'faturamento_consultas', rotulo: 'Em consultas', Icone: CalendarDays },
  { chave: 'faturamento_tratamentos', rotulo: 'Em tratamentos', Icone: FileText },
  { chave: 'faturamento_total', rotulo: 'Total', Icone: BarChart3, destaque: true },
  { chave: 'consultas_novas', rotulo: 'Consultas novas', Icone: CalendarPlus, quantidade: true },
]

const iguais = (a: MetasValores, b: MetasValores) => METRIC_KEYS.every((k) => a[k] === b[k])

const CHAVE_EXPLICACAO = 'metas:explicacao:recolhida'
const EVENTO_EXPLICACAO = 'metas:explicacao'

// Se a caixa "Como funciona" está recolhida. O valor salvo neste navegador é lido como um
// "armazenamento externo": no servidor vale o padrão (aberta) e no navegador o salvo, sem
// divergência na hidratação. Vale para os dois modos, é uma preferência só da pessoa.
function useExplicacaoRecolhida() {
  const salvo = useSyncExternalStore(
    (onChange) => {
      window.addEventListener('storage', onChange)
      window.addEventListener(EVENTO_EXPLICACAO, onChange)
      return () => {
        window.removeEventListener('storage', onChange)
        window.removeEventListener(EVENTO_EXPLICACAO, onChange)
      }
    },
    () => {
      try {
        return window.localStorage.getItem(CHAVE_EXPLICACAO) ?? ''
      } catch {
        return ''
      }
    },
    () => '',
  )
  // Se o navegador não deixar gravar (janela privada), vale só até recarregar.
  const [memoria, setMemoria] = useState<boolean | null>(null)
  const recolhida = memoria ?? salvo === '1'

  function alternar() {
    const novo = !recolhida
    try {
      if (novo) window.localStorage.setItem(CHAVE_EXPLICACAO, '1')
      else window.localStorage.removeItem(CHAVE_EXPLICACAO)
      setMemoria(null)
      window.dispatchEvent(new Event(EVENTO_EXPLICACAO))
    } catch {
      setMemoria(novo)
    }
  }
  return [recolhida, alternar] as const
}

// Caixa de explicação que o usuário pode recolher. Recolhida, sobra só o título.
function CaixaExplicacao({
  titulo,
  className,
  children,
}: {
  titulo: string
  className: string
  children: React.ReactNode
}) {
  const [recolhida, alternar] = useExplicacaoRecolhida()
  return (
    <div className={`rounded-2xl border text-navy ${className}`}>
      <button
        type="button"
        onClick={alternar}
        aria-expanded={!recolhida}
        aria-controls="metas-explicacao"
        className="flex w-full items-center justify-between gap-3 rounded-2xl px-4 py-3 text-left text-sm font-semibold"
      >
        {titulo}
        <span className="flex items-center gap-1.5 text-xs font-medium text-muted">
          {recolhida ? 'Mostrar' : 'Recolher'}
          <ChevronDown
            aria-hidden
            className={`size-4 transition-transform duration-200 ${recolhida ? '' : 'rotate-180'}`}
          />
        </span>
      </button>
      {recolhida ? null : (
        <div id="metas-explicacao" className="px-4 pb-4 text-[13px]">
          {children}
        </div>
      )}
    </div>
  )
}

function ExplicacaoModo({ modo }: { modo: Modo }) {
  if (modo === 'automatico') {
    return (
      <CaixaExplicacao titulo="Como funciona o modo automático" className="border-brand/30 bg-brand-50">
        <ol className="list-decimal space-y-1 pl-5">
          <li>
            Digite a meta de <b>Leads</b> (o único campo de etapa que você preenche).
          </li>
          <li>
            Digite as <b>4 taxas</b>, nos campos brancos ao lado do funil (por exemplo, 40% de qualificação).
          </li>
          <li>
            As outras etapas aparecem sozinhas (campos tracejados com ícone de calculadora):
            <ul className="mt-1 list-disc space-y-0.5 pl-5">
              <li>Leads qualificados = Leads × taxa de qualificação</li>
              <li>Consultas agendadas = Leads qualificados × taxa de agendamento</li>
              <li>Comparecimentos = Consultas agendadas × taxa de comparecimento</li>
              <li>Vendas = Comparecimentos × taxa de conversão</li>
            </ul>
          </li>
        </ol>
        <p className="mt-2">
          <b>Exemplo:</b> 1.000 leads com 40% de qualificação dão 400 leads qualificados; com 20% de agendamento, 80
          consultas agendadas. O balão à esquerda do funil mostra a taxa das consultas sobre os leads totais (aqui, 8%),
          só para leitura. Os resultados são arredondados para número inteiro.
        </p>
      </CaixaExplicacao>
    )
  }
  return (
    <CaixaExplicacao titulo="Como funciona o modo manual" className="border-border bg-black/[0.02]">
      <p>
        Você digita a meta de cada etapa e nada é recalculado. As taxas entre as etapas só mostram a proporção (cada etapa
        dividida pela base dela) e não podem ser editadas. Para o sistema calcular as etapas a partir de leads e taxas, troque
        para o modo <b>Automático</b>.
      </p>
    </CaixaExplicacao>
  )
}

// Tela de metas: faturamento e funil de metas editáveis, no mês e para a pessoa escolhidos.
export function MetasForm({
  vendedores,
  mesInicial,
  vendedorInicial,
  valoresIniciais,
  erroInicial,
}: {
  vendedores: Vendedor[]
  mesInicial: string
  vendedorInicial: string | null
  valoresIniciais: MetasValores
  erroInicial?: string
}) {
  const pedido = useRef(0)

  const [mes, setMes] = useState(mesInicial)
  const [vendedor, setVendedor] = useState<string | null>(vendedorInicial)
  const [valores, setValores] = useState<MetasValores>(valoresIniciais)
  const [original, setOriginal] = useState<MetasValores>(valoresIniciais)
  const [taxas, setTaxas] = useState<Taxas>(() => taxasDe(valoresIniciais))
  const [precoConsulta, setPrecoConsulta] = useState<number | null>(() => precoConsultaDe(valoresIniciais))
  const [modo, setModo] = useState<Modo>(() => modoInicial(valoresIniciais))
  const [auto, setAuto] = useState<ReadonlySet<MetricKey>>(new Set())
  const [carregando, setCarregando] = useState(false)
  const [mostrarMeses, setMostrarMeses] = useState(false)
  const [mensagem, setMensagem] = useState<{ tipo: 'ok' | 'erro'; texto: string } | null>(
    erroInicial ? { tipo: 'erro', texto: erroInicial } : null,
  )
  const [salvando, startSalvar] = useTransition()

  const alterado = !iguais(valores, original)

  // Avisa ao fechar ou recarregar a aba com alterações não salvas.
  useEffect(() => {
    if (!alterado) return
    const avisar = (e: BeforeUnloadEvent) => {
      e.preventDefault()
    }
    window.addEventListener('beforeunload', avisar)
    return () => window.removeEventListener('beforeunload', avisar)
  }, [alterado])

  async function carregar(novoMes: string, novoVendedor: string | null) {
    const id = ++pedido.current
    // Limpa já: enquanto a resposta não chega, não mostramos os valores de outro mês ou vendedor.
    setValores(VAZIO)
    setOriginal(VAZIO)
    setTaxas(TAXAS_VAZIAS)
    setPrecoConsulta(null)
    setAuto(new Set())
    setCarregando(true)
    setMensagem(null)
    const r = await loadMetas(novoMes, novoVendedor)
    if (id !== pedido.current) return // chegou uma resposta mais nova
    setCarregando(false)
    if (r.ok) {
      setValores(r.valores)
      setOriginal(r.valores)
      setTaxas(taxasDe(r.valores))
      setPrecoConsulta(precoConsultaDe(r.valores))
      setModo(modoInicial(r.valores))
    } else {
      setValores(VAZIO)
      setOriginal(VAZIO)
      setModo('automatico')
      setMensagem({ tipo: 'erro', texto: r.erro })
    }
  }

  function editarCampo(campo: Campo, texto: string) {
    const r = editar({ valores, taxas, precoConsulta }, campo, texto, modo)
    setValores(r.valores)
    setTaxas(r.taxas)
    setPrecoConsulta(r.precoConsulta)
    setAuto(new Set(r.auto))
    setMensagem(null)
  }

  function trocarModo(novo: Modo) {
    if (novo === modo) return
    setModo(novo)
    setTaxas(taxasDe(valores))
    setAuto(new Set())
    setMensagem(null)
  }

  const descartarOk = () => !alterado || window.confirm('Há alterações não salvas. Descartar?')

  function trocar(novoMes: string, novoVendedor: string | null) {
    if (novoMes === mes && novoVendedor === vendedor) return
    if (!descartarOk()) return
    setMes(novoMes)
    setVendedor(novoVendedor)
    setMostrarMeses(false)
    void carregar(novoMes, novoVendedor)
  }

  function desfazer() {
    setValores(original)
    setTaxas(taxasDe(original))
    setPrecoConsulta(precoConsultaDe(original))
    setModo(modoInicial(original))
    setAuto(new Set())
    setMensagem(null)
  }

  function salvar(e: React.FormEvent) {
    e.preventDefault()
    if (salvando || carregando) return
    startSalvar(async () => {
      const r = await saveMetas({ mes, vendedorId: vendedor, valores })
      if (r.ok) {
        setOriginal(valores)
        setMensagem({ tipo: 'ok', texto: 'Metas salvas.' })
      } else {
        setMensagem({ tipo: 'erro', texto: r.erro })
      }
    })
  }

  const tabs: { id: string | null; label: string }[] = [
    { id: null, label: 'Clínica toda' },
    ...vendedores.map((v) => ({ id: v.id, label: v.nome })),
  ]

  const nav =
    'flex size-9 items-center justify-center rounded-full border border-border bg-card text-muted transition-colors duration-200 hover:border-brand hover:text-navy'

  const opcaoModo = (valor: Modo, titulo: string, sub: string) => {
    const ativo = modo === valor
    return (
      <button
        type="button"
        role="radio"
        aria-checked={ativo}
        onClick={() => trocarModo(valor)}
        className={`rounded-full px-4 py-2 text-left text-sm transition-colors duration-200 ${
          ativo ? 'bg-navy text-white' : 'text-navy hover:bg-brand-50'
        }`}
      >
        <span className="font-semibold">{titulo}</span>
        <span className={`ml-1.5 text-xs ${ativo ? 'text-white/75' : 'text-muted'}`}>{sub}</span>
      </button>
    )
  }

  return (
    <form onSubmit={salvar} className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1.5">
          <button type="button" className={nav} aria-label="Mês anterior" onClick={() => trocar(shiftMonth(mes, -1), vendedor)}>
            <ChevronLeft aria-hidden className="size-4" />
          </button>
          <button
            type="button"
            className="btn btn-ghost btn-sm min-w-[190px]"
            aria-expanded={mostrarMeses}
            onClick={() => setMostrarMeses((v) => !v)}
          >
            <CalendarDays aria-hidden className="size-4 text-muted" />
            {monthLabel(mes)}
          </button>
          <button type="button" className={nav} aria-label="Próximo mês" onClick={() => trocar(shiftMonth(mes, 1), vendedor)}>
            <ChevronRight aria-hidden className="size-4" />
          </button>
        </div>

        <div role="group" aria-label="Metas de quem" className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-medium text-muted">Vendedor</span>
          {tabs.map((t) => {
            const ativo = t.id === vendedor
            return (
              <button
                key={t.id ?? 'clinica'}
                type="button"
                aria-pressed={ativo}
                onClick={() => trocar(mes, t.id)}
                className={`rounded-full px-4 py-2 text-sm font-medium transition-colors duration-200 ${
                  ativo ? 'bg-navy text-white' : 'border border-border bg-card text-navy hover:border-brand'
                }`}
              >
                {t.label}
              </button>
            )
          })}
        </div>
      </div>

      {mostrarMeses ? (
        <div className="max-w-[300px] rounded-2xl border border-border bg-card p-4">
          <MonthGrid selected={mes} onPick={(m) => trocar(m, vendedor)} />
        </div>
      ) : null}

      <div className={`space-y-5 ${carregando ? 'opacity-50' : ''}`} aria-busy={carregando}>
        <section aria-labelledby="metas-fat-titulo" className="card p-5 sm:p-6">
          <h2 id="metas-fat-titulo" className="text-xl font-bold tracking-tight text-navy">
            Metas de faturamento
          </h2>
          <div className="mt-4">
            <SortableCards
              storageKey="metas:ordem:faturamento"
              dndId="metas-faturamento"
              className="grid gap-4 md:grid-cols-2 xl:grid-cols-4"
              items={FATURAMENTO.map(
                ({ chave, rotulo, Icone, destaque, quantidade }): SortableItem => ({
                  id: chave,
                  label: rotulo,
                  node: (
                    <div
                      className={`rounded-2xl border p-4 pb-9 ${
                        destaque ? 'border-brand/40 border-t-4 border-t-brand bg-brand-50' : 'border-border bg-card'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <span aria-hidden className="flex size-9 items-center justify-center rounded-full bg-brand-50 text-brand-ink">
                          <Icone className="size-[18px]" />
                        </span>
                        <label htmlFor={`meta-${chave}`} className="text-sm font-semibold text-navy">
                          {rotulo}
                        </label>
                      </div>
                      <div className="relative mt-3">
                        {quantidade ? null : (
                          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm font-medium text-muted">
                            R$
                          </span>
                        )}
                        <input
                          id={`meta-${chave}`}
                          type="number"
                          inputMode={quantidade ? 'numeric' : 'decimal'}
                          min="0"
                          step={quantidade ? '1' : '0.01'}
                          value={valores[chave]}
                          disabled={carregando}
                          placeholder="0"
                          onChange={(e) => editarCampo({ tipo: 'valor', chave }, e.target.value)}
                          className={`input no-spin pr-9 text-lg font-bold ${quantidade ? 'pl-3' : 'pl-10'} ${auto.has(chave) ? DESTAQUE : ''}`}
                        />
                        <Pencil aria-hidden className="pointer-events-none absolute right-3 top-1/2 size-3.5 -translate-y-1/2 text-muted" />
                      </div>
                    </div>
                  ),
                }),
              )}
            />
          </div>
          <p className="mt-3 text-xs text-muted">
            O total é a soma das metas de consultas e de tratamentos e muda sozinho quando você as altera. Você pode ajustá-lo à
            mão. Consultas novas é uma quantidade, não um valor em reais. Se Em consultas e Consultas novas já tiverem valor,
            mudar a quantidade recalcula Em consultas sozinho, mantendo o mesmo valor por consulta (edite Em consultas direto
            para mudar esse valor por consulta). Arraste pela alça no canto de cada cartão para reordenar.
          </p>
        </section>

        <section aria-labelledby="metas-funil-titulo" className="card p-5 sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 id="metas-funil-titulo" className="text-xl font-bold tracking-tight text-navy">
                Metas do funil
              </h2>
              <p className="mt-0.5 text-sm text-muted">Escolha como quer preencher as metas das etapas.</p>
            </div>
            <div role="radiogroup" aria-label="Modo de preenchimento do funil" className="flex flex-wrap gap-1 rounded-full bg-black/[0.04] p-1">
              {opcaoModo('automatico', 'Automático', 'leads + taxas')}
              {opcaoModo('manual', 'Manual', 'digito cada etapa')}
            </div>
          </div>

          <div className="mt-4">
            <ExplicacaoModo modo={modo} />
          </div>

          {/* Largura limitada: o funil usa porcentagem do espaço e esticaria em telas largas */}
          <div className="mx-auto mt-6 max-w-[680px]">
            <MetasFunnel
              modo={modo}
              valores={valores}
              taxas={taxas}
              auto={auto}
              disabled={carregando}
              onValor={(chave, texto) => editarCampo({ tipo: 'valor', chave }, texto)}
              onTaxa={(chave, texto) => editarCampo({ tipo: 'taxa', chave }, texto)}
            />
          </div>
          <p className="mt-4 text-center text-xs text-muted">
            Qualificação é calculada sobre os leads; agendamento, sobre os leads qualificados; comparecimento, sobre as consultas
            agendadas; conversão, sobre os comparecimentos. O balão à esquerda (agend. sobre leads) é consultas agendadas ÷
            leads totais. As taxas não são salvas: só as metas.
          </p>
        </section>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-col gap-1">
          <p className="flex items-center gap-2 text-xs text-muted">
            <Info aria-hidden className="size-4" />
            Deixe um campo em branco para não definir meta.
          </p>
          <p
            role={mensagem?.tipo === 'erro' ? 'alert' : 'status'}
            className={`text-sm ${mensagem?.tipo === 'erro' ? 'text-status-abaixo' : 'text-status-acima'}`}
          >
            {carregando ? <span className="text-muted">Carregando as metas...</span> : (mensagem?.texto ?? '')}
          </p>
        </div>
        <div className="flex gap-2">
          {alterado ? (
            <button type="button" className="btn btn-ghost" onClick={desfazer}>
              <RotateCcw aria-hidden className="size-4" />
              Desfazer alterações
            </button>
          ) : null}
          <button type="submit" className="btn btn-primary" disabled={salvando || carregando || !alterado}>
            {salvando ? 'Salvando...' : 'Salvar metas'}
          </button>
        </div>
      </div>
    </form>
  )
}
