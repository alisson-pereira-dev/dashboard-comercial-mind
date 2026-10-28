// Tratamentos novos não tem meta própria cadastrada em Metas (decisão de 28/10/2026, ao contrário
// de Consultas novas): a meta mostrada no cartão do dashboard vem da meta de faturamento "Em
// tratamentos" (R$) já cadastrada, dividida pelo preço médio por tratamento do período
// (faturamento em tratamentos realizado ÷ tratamentos novos realizados). Sem preço médio ainda
// (nenhum tratamento realizado no período) ou sem a meta de Em tratamentos, não há meta para
// mostrar.
export function metaTratamentosNovos(
  metaFaturamentoTratamentos: number | null,
  realizadoFaturamentoTratamentos: number,
  realizadoTratamentosNovos: number,
): number | null {
  if (metaFaturamentoTratamentos === null) return null
  if (realizadoFaturamentoTratamentos <= 0 || realizadoTratamentosNovos <= 0) return null
  const precoMedio = realizadoFaturamentoTratamentos / realizadoTratamentosNovos
  return Math.round(metaFaturamentoTratamentos / precoMedio)
}
