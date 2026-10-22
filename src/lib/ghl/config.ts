// Ids dos campos personalizados da location piloto. Mudam por clínica:
// sobrescreva por variável de ambiente ao subir outra instância.
export const GHL_FIELD_MQL_ID = process.env.GHL_FIELD_MQL_ID ?? 'MVQhUw5Vxr7PVviLr39u'
export const GHL_FIELD_INICIO_TRATAMENTO_ID =
  process.env.GHL_FIELD_INICIO_TRATAMENTO_ID ?? 'gs5tLZ5CXwb1HjXFBsyy'

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
