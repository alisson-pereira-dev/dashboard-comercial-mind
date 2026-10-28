import type { MetricKey } from './metrics/types'

// Regras de preenchimento do formulário de metas. Só o que é digitado vai para o banco (os 10
// valores de METRIC_KEYS). As taxas do funil nunca são salvas: ou servem para calcular as etapas
// (modo automático) ou só mostram a proporção entre elas (modo manual).

export type Valores = Record<MetricKey, string>

export type TaxaKey = 'qualificacao' | 'agendamento' | 'comparecimento' | 'conversao'
export type Taxas = Record<TaxaKey, string> // percentual em texto, ex.: "58.5"

/**
 * automatico: você digita os Leads e as 4 taxas; as outras 4 etapas são calculadas.
 * manual: você digita a meta de cada etapa; as taxas são só uma leitura.
 */
export type Modo = 'automatico' | 'manual'

// Mesmas fórmulas do dashboard: qualificação é sobre os leads; agendamento, sobre os leads
// qualificados; comparecimento, sobre as consultas agendadas; conversão, sobre os comparecimentos.
export const TAXAS: { key: TaxaKey; base: MetricKey; alvo: MetricKey; nome: string; formula: string }[] = [
  { key: 'qualificacao', base: 'leads', alvo: 'leads_qualificados', nome: 'qualificação', formula: 'Leads qualificados ÷ leads' },
  { key: 'agendamento', base: 'leads_qualificados', alvo: 'consultas_agendadas', nome: 'agendamento', formula: 'Consultas agendadas ÷ leads qualificados' },
  { key: 'comparecimento', base: 'consultas_agendadas', alvo: 'comparecimentos', nome: 'comparecimento', formula: 'Comparecimentos ÷ consultas agendadas' },
  { key: 'conversao', base: 'comparecimentos', alvo: 'vendas', nome: 'conversão', formula: 'Vendas ÷ comparecimentos' },
]

// Taxa só de leitura mostrada no funil: consultas agendadas sobre os leads totais. Não é digitada
// nem entra no cálculo das etapas (as etapas saem das 4 taxas acima).
export function agendamentoSobreLeads(valores: Valores): string {
  const base = num(valores.leads)
  const alvo = num(valores.consultas_agendadas)
  return base !== null && base > 0 && alvo !== null ? duasCasas((alvo / base) * 100) : ''
}

export const ETAPAS_FUNIL: MetricKey[] = ['leads', 'leads_qualificados', 'consultas_agendadas', 'comparecimentos', 'vendas']

export const TAXAS_VAZIAS: Taxas = { qualificacao: '', agendamento: '', comparecimento: '', conversao: '' }

export type Campo = { tipo: 'valor'; chave: MetricKey } | { tipo: 'taxa'; chave: TaxaKey }
// precoConsulta e precoTratamento: valor por consulta/tratamento usado para recalcular Em
// consultas (quando Consultas novas muda) e Em tratamentos (quando Tratamentos novos muda). Só são
// redefinidos quando o usuário edita o valor em reais direto (nunca por uma edição da quantidade);
// por isso precisam viajar no estado, em vez de serem derivados de novo a cada edição a partir dos
// dois campos: depois que o valor em reais já foi multiplicado uma vez, ele deixa de ser "o preço
// de uma unidade" e vira um total, e dividir de novo por uma quantidade zerada ou em branco (ex.:
// campo apagado para digitar de novo) devolveria um valor por unidade errado.
export type Estado = { valores: Valores; taxas: Taxas; precoConsulta: number | null; precoTratamento: number | null }

// Número válido (zero ou mais) ou null para vazio e texto inválido.
function num(texto: string): number | null {
  const s = texto.trim().replace(',', '.')
  if (s === '') return null
  const n = Number(s)
  return Number.isFinite(n) && n >= 0 ? n : null
}

const inteiro = (n: number) => String(Math.round(n))
const duasCasas = (n: number) => String(Math.round(n * 100) / 100)

// Valor por unidade implícito num par valor/quantidade (ex.: R$ 4.800 para 10 consultas = R$ 480
// por consulta). Sem quantidade preenchida ainda, o próprio valor é o valor por unidade (não há
// pelo que dividir).
function precoPorQtd(preco: string, qtd: string): number | null {
  const p = num(preco)
  if (p === null) return null
  const q = num(qtd)
  return q !== null && q > 0 ? p / q : p
}

// Valor por consulta implícito em Em consultas e Consultas novas. Usado para montar o estado
// inicial, ao carregar um mês ou desfazer alterações; dali em diante, editar() mantém o valor por
// consulta sozinho.
export function precoConsultaDe(valores: Valores): number | null {
  return precoPorQtd(valores.faturamento_consultas, valores.consultas_novas)
}

// Mesma ideia de precoConsultaDe, para Em tratamentos e Tratamentos novos.
export function precoTratamentoDe(valores: Valores): number | null {
  return precoPorQtd(valores.faturamento_tratamentos, valores.tratamentos_novos)
}

// Taxas implícitas nos valores (ex.: 87 qualificados de 150 leads = 58%).
export function taxasDe(valores: Valores): Taxas {
  const out = { ...TAXAS_VAZIAS }
  for (const t of TAXAS) {
    const base = num(valores[t.base])
    const alvo = num(valores[t.alvo])
    if (base !== null && base > 0 && alvo !== null) out[t.key] = duasCasas((alvo / base) * 100)
  }
  return out
}

// Meses já com metas do funil abrem em manual (mostram o que foi salvo, sem recalcular nada);
// meses vazios abrem em automático.
export function modoInicial(valores: Valores): Modo {
  return ETAPAS_FUNIL.some((k) => num(valores[k]) !== null) ? 'manual' : 'automatico'
}

/**
 * Aplica uma edição e devolve o novo estado, com a lista de valores calculados automaticamente
 * (para destacar na tela).
 *
 * Modo automático:
 * - Editar os Leads (ou outra etapa): as etapas que dependem dela são recalculadas pelas taxas.
 * - Editar uma taxa: a etapa seguinte é recalculada (base x taxa) e as que dependem dela também.
 * Modo manual:
 * - Editar uma etapa só muda aquela etapa; as taxas são recalculadas apenas para exibição.
 * Nos dois modos:
 * - Editar faturamento em consultas ou em tratamentos faz o total virar a soma dos dois.
 * - Editar consultas novas (ou tratamentos novos) recalcula o faturamento em consultas (ou em
 *   tratamentos) na hora, multiplicando pela nova quantidade, e o total junto. O valor por unidade
 *   vem de `precoConsultaDe`/`precoTratamentoDe` (valor ÷ quantidade, ou o próprio valor se a
 *   quantidade ainda estiver em branco) e só é redefinido quando o usuário edita o valor em reais
 *   direto; editar a quantidade nunca o toca, só o usa. Assim o valor por unidade sobrevive mesmo
 *   se a quantidade for apagada e digitada de novo no meio do caminho. Sem um valor por unidade
 *   ainda definido, nada é calculado sozinho.
 * - Valores em branco ou inválidos nunca disparam cálculo.
 */
export function editar(
  estado: Estado,
  campo: Campo,
  texto: string,
  modo: Modo = 'automatico',
): Estado & { auto: MetricKey[] } {
  const valores: Valores = { ...estado.valores }
  const taxas: Taxas = { ...estado.taxas }
  const auto = new Set<MetricKey>()
  let precoConsulta = estado.precoConsulta
  let precoTratamento = estado.precoTratamento

  const propagar = (origem: MetricKey) => {
    for (const t of TAXAS) {
      if (t.base !== origem) continue
      const base = num(valores[origem])
      const taxa = num(taxas[t.key])
      if (base === null || taxa === null) continue
      valores[t.alvo] = inteiro((base * taxa) / 100)
      auto.add(t.alvo)
      propagar(t.alvo)
    }
  }

  if (campo.tipo === 'valor') {
    valores[campo.chave] = texto

    if (campo.chave === 'faturamento_consultas') {
      precoConsulta = precoConsultaDe(valores)
    }
    if (campo.chave === 'faturamento_tratamentos') {
      precoTratamento = precoTratamentoDe(valores)
    }

    if (campo.chave === 'consultas_novas') {
      const qtdNova = num(texto)
      if (precoConsulta !== null && qtdNova !== null) {
        valores.faturamento_consultas = duasCasas(precoConsulta * qtdNova)
        auto.add('faturamento_consultas')
      }
    }
    if (campo.chave === 'tratamentos_novos') {
      const qtdNova = num(texto)
      if (precoTratamento !== null && qtdNova !== null) {
        valores.faturamento_tratamentos = duasCasas(precoTratamento * qtdNova)
        auto.add('faturamento_tratamentos')
      }
    }

    if (
      campo.chave === 'faturamento_consultas' ||
      campo.chave === 'faturamento_tratamentos' ||
      campo.chave === 'consultas_novas' ||
      campo.chave === 'tratamentos_novos'
    ) {
      const c = num(valores.faturamento_consultas)
      const t = num(valores.faturamento_tratamentos)
      valores.faturamento_total = c === null && t === null ? '' : duasCasas((c ?? 0) + (t ?? 0))
      auto.add('faturamento_total')
    }

    if (modo === 'manual') {
      return { valores, taxas: taxasDe(valores), precoConsulta, precoTratamento, auto: [...auto] }
    }

    for (const t of TAXAS) {
      if (t.alvo !== campo.chave) continue
      const base = num(valores[t.base])
      const alvo = num(texto)
      if (base !== null && base > 0 && alvo !== null) taxas[t.key] = duasCasas((alvo / base) * 100)
    }
    propagar(campo.chave)
  } else {
    taxas[campo.chave] = texto
    const t = TAXAS.find((x) => x.key === campo.chave)!
    const base = num(valores[t.base])
    const taxa = num(texto)
    if (base !== null && taxa !== null) {
      valores[t.alvo] = inteiro((base * taxa) / 100)
      auto.add(t.alvo)
      propagar(t.alvo)
    }
  }

  return { valores, taxas, precoConsulta, precoTratamento, auto: [...auto] }
}
