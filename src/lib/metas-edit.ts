import type { MetricKey } from './metrics/types'

// Regras de preenchimento do formulário de metas. Só o que é digitado vai para o banco (os 8
// valores). As taxas do funil nunca são salvas: ou servem para calcular as etapas (modo
// automático) ou só mostram a proporção entre elas (modo manual).

export type Valores = Record<MetricKey, string>

export type TaxaKey = 'qualificacao' | 'agendamento' | 'comparecimento' | 'conversao'
export type Taxas = Record<TaxaKey, string> // percentual em texto, ex.: "58.5"

/**
 * automatico: você digita os Leads e as 4 taxas; as outras 4 etapas são calculadas.
 * manual: você digita a meta de cada etapa; as taxas são só uma leitura.
 */
export type Modo = 'automatico' | 'manual'

// Mesmas fórmulas do dashboard: qualificação e agendamento são sobre os leads.
export const TAXAS: { key: TaxaKey; base: MetricKey; alvo: MetricKey; nome: string; formula: string }[] = [
  { key: 'qualificacao', base: 'leads', alvo: 'leads_qualificados', nome: 'qualificação', formula: 'Leads qualificados ÷ leads' },
  { key: 'agendamento', base: 'leads', alvo: 'consultas_agendadas', nome: 'agendamento', formula: 'Consultas agendadas ÷ leads' },
  { key: 'comparecimento', base: 'consultas_agendadas', alvo: 'comparecimentos', nome: 'comparecimento', formula: 'Comparecimentos ÷ consultas agendadas' },
  { key: 'conversao', base: 'comparecimentos', alvo: 'vendas', nome: 'conversão', formula: 'Vendas ÷ comparecimentos' },
]

export const ETAPAS_FUNIL: MetricKey[] = ['leads', 'leads_qualificados', 'consultas_agendadas', 'comparecimentos', 'vendas']

export const TAXAS_VAZIAS: Taxas = { qualificacao: '', agendamento: '', comparecimento: '', conversao: '' }

export type Campo = { tipo: 'valor'; chave: MetricKey } | { tipo: 'taxa'; chave: TaxaKey }
export type Estado = { valores: Valores; taxas: Taxas }

// Número válido (zero ou mais) ou null para vazio e texto inválido.
function num(texto: string): number | null {
  const s = texto.trim().replace(',', '.')
  if (s === '') return null
  const n = Number(s)
  return Number.isFinite(n) && n >= 0 ? n : null
}

const inteiro = (n: number) => String(Math.round(n))
const duasCasas = (n: number) => String(Math.round(n * 100) / 100)

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

    if (campo.chave === 'faturamento_consultas' || campo.chave === 'faturamento_tratamentos') {
      const c = num(valores.faturamento_consultas)
      const t = num(valores.faturamento_tratamentos)
      valores.faturamento_total = c === null && t === null ? '' : duasCasas((c ?? 0) + (t ?? 0))
      auto.add('faturamento_total')
    }

    if (modo === 'manual') {
      return { valores, taxas: taxasDe(valores), auto: [...auto] }
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

  return { valores, taxas, auto: [...auto] }
}
