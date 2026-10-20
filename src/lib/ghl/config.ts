// Ids dos campos personalizados da location piloto. Mudam por clínica:
// sobrescreva por variável de ambiente ao subir outra instância.
export const GHL_FIELD_MQL_ID = process.env.GHL_FIELD_MQL_ID ?? 'MVQhUw5Vxr7PVviLr39u'
export const GHL_FIELD_INICIO_TRATAMENTO_ID =
  process.env.GHL_FIELD_INICIO_TRATAMENTO_ID ?? 'gs5tLZ5CXwb1HjXFBsyy'

// Pipelines de pacientes já em tratamento: não contam como venda nem MQL do funil.
export const PIPELINES_FORA_DO_FUNIL = ['Clientes da base']

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
