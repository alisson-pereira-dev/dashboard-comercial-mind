// Faturamento em consultas a partir das oportunidades que estão nas etapas de consulta.
// O valor da oportunidade já inclui o tratamento quando ele foi fechado (ex.: R$ 5.670 com Valor do
// tratamento de R$ 5.350 = R$ 320 de consulta + R$ 5.350 de tratamento). Para o tratamento não
// entrar duas vezes (aqui e em "Em tratamentos"), a parte de consulta é o valor menos o tratamento.
export type OportunidadeConsulta = {
  valor: number | string
  valor_tratamento?: number | string | null
}

export function valorDeConsulta(o: OportunidadeConsulta): number {
  return Math.max(Number(o.valor || 0) - Number(o.valor_tratamento ?? 0), 0)
}

export function somaConsultas(oportunidades: OportunidadeConsulta[]): number {
  return oportunidades.reduce((acc, o) => acc + valorDeConsulta(o), 0)
}
