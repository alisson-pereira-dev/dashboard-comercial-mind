// Lê uma variável de ambiente em tempo de execução, no servidor.
//
// Escrito como process.env.NEXT_PUBLIC_X, o Next troca a variável pelo valor NA HORA DO BUILD, e
// o valor fica gravado no código. Com o nome numa variável (process.env[nome]) isso não acontece:
// o valor vem do ambiente do servidor a cada início. Assim a imagem Docker não depende de build
// args e mudar uma variável só pede reiniciar o serviço, sem novo build.
//
// Só para código de servidor. Nada aqui chega ao navegador.
export function runtimeEnv(nome: string): string | undefined {
  const valor = process.env[nome]?.trim()
  return valor ? valor : undefined
}
