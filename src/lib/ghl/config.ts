// Ids dos campos personalizados da location piloto. Mudam por clínica:
// sobrescreva por variável de ambiente ao subir outra instância.
export const GHL_FIELD_MQL_ID = process.env.GHL_FIELD_MQL_ID ?? 'MVQhUw5Vxr7PVviLr39u'
// Campo de oportunidade "Valor do tratamento" (monetário): base do faturamento em tratamentos.
export const GHL_FIELD_VALOR_TRATAMENTO_ID =
  process.env.GHL_FIELD_VALOR_TRATAMENTO_ID?.trim() || 's9irWLPUo1HwtXBM7pni'
export const GHL_FIELD_INICIO_TRATAMENTO_ID =
  process.env.GHL_FIELD_INICIO_TRATAMENTO_ID ?? 'gs5tLZ5CXwb1HjXFBsyy'

// Etapas do pipeline do funil em que a consulta já está marcada ou feita: "Consulta  Agendada" e
// "Pós consulta" (ids da location piloto; o nome no GHL tem dois espaços). Consultas novas e
// tratamentos novos contam as oportunidades nas duas; Fechamentos em consulta e Fechamentos em
// follow up contam as ganhas de cada uma. Sobrescreva por GHL_ETAPA_CONSULTA_AGENDADA_ID e
// GHL_ETAPA_POS_CONSULTA_ID ao subir outra clínica.
export const ETAPA_CONSULTA_AGENDADA_ID =
  process.env.GHL_ETAPA_CONSULTA_AGENDADA_ID?.trim() || '68bce141-2351-477d-9b92-1fc3cf846650'
export const ETAPA_POS_CONSULTA_ID =
  process.env.GHL_ETAPA_POS_CONSULTA_ID?.trim() || 'aed1d454-d7e3-45d5-8d81-ead7f452c3b8'
export const ETAPAS_CONSULTA_IDS = [ETAPA_CONSULTA_AGENDADA_ID, ETAPA_POS_CONSULTA_ID]

// Valor de cada consulta no faturamento em consultas: R$ 160 quando agendada e R$ 320 quando
// comparecida (o valor de comparecida substitui o de agendada). Sobrescreva por
// VALOR_CONSULTA_AGENDADA e VALOR_CONSULTA_COMPARECIDA se o preço da clínica mudar.
const numeroPositivo = (v: string | undefined, padrao: number) => {
  const n = Number(v?.trim().replace(',', '.'))
  return Number.isFinite(n) && n > 0 ? n : padrao
}
export const VALOR_CONSULTA = {
  agendada: numeroPositivo(process.env.VALOR_CONSULTA_AGENDADA, 160),
  comparecida: numeroPositivo(process.env.VALOR_CONSULTA_COMPARECIDA, 320),
}

// Pipeline em que o funil é medido (decisão de 22/10/2026): leads, leads qualificados e vendas são
// oportunidades deste pipeline. Os demais (Clientes da base, Geladeira, Reativação) ficam de fora.
// Mude por GHL_PIPELINE_FUNIL se o nome no GHL for outro nesta clínica.
export const PIPELINE_FUNIL = process.env.GHL_PIPELINE_FUNIL?.trim() || 'Qualificação ( IA )'

// Janela de agendamentos buscada no sync.
export const EVENTOS_DIAS_PASSADO = 730
export const EVENTOS_DIAS_FUTURO = 90

// Vendedores (ids de usuário do GHL). O primeiro é o padrão: registros sem responsável
// no GHL são atribuídos a ele no dashboard. Nada é escrito de volta no GHL.
export const VENDEDORES_IDS = (process.env.GHL_VENDEDORES_IDS ?? '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean)
export const VENDEDOR_PADRAO_ID: string | null = VENDEDORES_IDS[0] ?? null
