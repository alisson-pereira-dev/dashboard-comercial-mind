// Lista das oportunidades que formam o cartão "Em tratamentos": quem é o paciente, quando foi marcada como
// ganha, quando foi criada e quanto vale. Montada com a MESMA regra do cartão (oportunidades ganhas do
// pipeline do funil, pela data em que foram marcadas como ganhas), então a soma dos valores é igual ao cartão.

export type OportunidadeRow = {
  id: string
  contato_id: string | null
  valor: number | string | null
  criado_em: string
  fechado_em: string
}

export type TratamentoLinha = {
  id: string
  paciente: string
  /** Quando a oportunidade foi criada (informativo). */
  criadoEm: string
  /** Quando foi marcada como ganha (é essa data que define o período). */
  fechadoEm: string
  valor: number
}

export function montarTratamentos(
  oportunidades: OportunidadeRow[],
  nomes: Map<string, string | null>,
): { tratamentos: TratamentoLinha[]; total: number } {
  const tratamentos = oportunidades
    .map((o): TratamentoLinha => {
      const nome = o.contato_id ? nomes.get(o.contato_id)?.trim() : ''
      return {
        id: o.id,
        paciente: nome || 'Sem nome no GHL',
        criadoEm: o.criado_em,
        fechadoEm: o.fechado_em,
        valor: Number(o.valor ?? 0),
      }
    })
    .sort((x, y) => x.fechadoEm.localeCompare(y.fechadoEm))
  return { tratamentos, total: tratamentos.reduce((acc, t) => acc + t.valor, 0) }
}
