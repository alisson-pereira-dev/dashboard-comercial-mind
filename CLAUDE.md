# CLAUDE.md - Dashboard Comercial Mindsight

Guia de contexto lido em toda sessão do Claude Code neste repositório. Atualize este arquivo sempre que uma decisão de arquitetura ou regra de negócio mudar, para não ficar defasado em relação ao código.

## 1. Projeto e objetivo

Dashboard comercial centralizado para clínicas atendidas pela Mindsight. Lê dados da API do GoHighLevel (GHL) e mostra realizado vs. meta, por mês, com filtro de período customizado.

- Público: apenas o gestor da clínica (Dra. Eva) e a equipe Mindsight. A vendedora (Gabriela) NÃO tem acesso: o dashboard é uma ferramenta de acompanhamento gerencial para entender o desempenho da vendedora e, por consequência, o da clínica. Não criar login para ela.
- Não é: substituto do GHL como CRM. É uma camada de visualização, cálculo de taxas e gestão de metas em cima dos dados que já vivem no GHL.
- Sem escrita de volta no GHL no MVP. Acesso ao GHL é somente leitura.

**Escopo do MVP**

- Bloco 1: Dashboard Central (funil, taxas, números de vendas, realizado vs. meta)
- Bloco 3: Metas Comerciais (cadastro e edição dentro da plataforma, sem fluxo de aprovação)
- Integração de leitura com GHL: oportunidades, calendário, pagamentos, contatos, usuários

**Fora do MVP (fase 2)**

- Bloco 2: Atividades Comerciais (depende de definir o que conta como atividade)
- Escrita no GHL, multi-clínica no mesmo painel, alertas automáticos

**Decisões já tomadas**

- Produto de uma única clínica. Cada clínica tem seu próprio deploy e seu próprio projeto Supabase. Não é multi-tenant: nenhuma tabela tem coluna `clinica_id` e não existe tabela de clínicas.
- Atualização de dados sob demanda: botão "Atualizar dados" dispara o sync. Sem agendamento periódico no MVP.
- Metas são criadas e editadas na própria plataforma.

## 2. Stack técnica

| Camada | Escolha | Por quê |
| --- | --- | --- |
| Frontend e servidor | Next.js (App Router) + TypeScript | Route Handlers mantêm o token do GHL só no servidor e rodam o sync junto do app |
| UI | Tailwind CSS + shadcn/ui | Componentes consistentes e fáceis de aplicar a paleta Mindsight |
| Gráficos | Recharts | Barras, progresso e comparação meta vs. realizado |
| Banco e auth | Supabase (Postgres + Auth) | Padrão nos outros projetos da Mindsight |
| Testes | Vitest | Funções de cálculo puras, rápidas de testar |

Regra central: o frontend lê apenas do Supabase. O GHL só é chamado pelo sync (`src/app/api/sync`). Nunca buscar o GHL direto a cada carregamento de tela (rate limit e latência).

**Deploy**: VPS com Easypanel (ou qualquer host Docker), montado pelo `Dockerfile` da raiz (Next.js em modo `standalone`, imagem em 3 etapas, usuário não-root, porta 3000, healthcheck em `/login`). Pontos que exigem cuidado:

- Nenhuma variável é necessária no build: todas (Supabase, GHL e nome da clínica) são lidas em tempo de execução, então o Easypanel não precisa passar build args e mudar uma variável só pede reiniciar o serviço. Isso vale porque o app só usa `NEXT_PUBLIC_*` no servidor, via `runtimeEnv()` em `src/lib/env.ts`. **Nunca ler essas variáveis como `process.env.NEXT_PUBLIC_X` direto**: o Next troca o valor por texto fixo no build (e, sem build arg, fica vazio). O nome da clínica é lido a cada pedido por `components/clinica-nome.tsx` (`await connection()`), para não ficar congelado na página pré-renderizada. Se um dia houver código que rode no navegador e precise de variável, ela volta a ser de build.
- Segredos (`GHL_TOKEN`, `SUPABASE_SERVICE_ROLE_KEY`, etc.) não entram na imagem. O `.dockerignore` deixa todo `.env*` (exceto `.env.example`) fora do contexto de build; não remover.
- A porta vem de `PORT` (o Easypanel a define, em geral 80; o padrão da imagem é 3000) e o healthcheck usa a mesma variável. Healthcheck com porta fixa faz o container ficar `unhealthy` e o Easypanel reiniciá-lo em ciclo. O domínio do serviço no Easypanel deve apontar para a mesma porta.
- O Git não guarda pastas vazias: o Dockerfile cria `public` antes do build, senão o `COPY` falha em clone limpo. Teste mudanças no Dockerfile a partir de um `git clone`, não da pasta de trabalho.
- O modo standalone só liga com `NEXT_OUTPUT=standalone` (definido no Dockerfile), para `npm run build` e `npm start` locais seguirem iguais.
- Valores de variáveis sem espaço no início ou no fim. O código faz `trim()` no token e no id da location, mas o resto não.
- O sync leva cerca de 30 s com 1.400 contatos. O proxy reverso da VPS não pode ter timeout menor que isso (e o tempo cresce com a base).
- Repositório privado: o Easypanel precisa da chave de deploy ou do token do GitHub para clonar.

**Supabase**: projeto dedicado a este dashboard, separado do projeto dos agentes de IA (que guarda tabelas por cliente e não deve compartilhar chaves nem login com esta aplicação). A função `public.set_updated_at` já existe no projeto e deve ser reutilizada nos triggers de `updated_at`.

**Plano de migração para multi-tenant** (só depois de validar com uma clínica): criar tabela de clínicas, adicionar `clinica_id` nas tabelas preenchendo os registros existentes com a primeira clínica, trocar o RLS para filtrar por `clinica_id` e mover `location_id` e token do GHL das variáveis de ambiente para a tabela. Para facilitar, `lib/metrics` e `lib/ghl` não devem depender de qual clínica está sendo processada.

## 3. Convenções e estrutura de pastas

```
src/
  app/
    (app)/              rotas protegidas, dentro do menu lateral (app-shell)
      page.tsx          Bloco 1: dashboard central
      metas/            Bloco 3: página de metas (formulário em components/metas-form.tsx; gravação em lib/metas-actions.ts)
    login/              login por e-mail e senha (usuários criados no painel do Supabase)
    api/sync/           Route Handler do sync sob demanda
  proxy.ts              renova a sessão e redireciona quem não está logado para /login
  lib/
    ghl/                cliente da API e mapeadores GHL -> modelo próprio
    metrics/            funções puras de taxas e agregações (sem I/O)
    supabase/           clientes (server e admin) e queries
  components/           componentes de UI reutilizáveis
supabase/migrations/    SQL versionado, uma migration por mudança
docs/                   notas de modelagem e decisões
  documentacao-dashboard.html   documentação completa para a empresa (uso, dados, métricas, limitações)
```

- TypeScript em modo estrito. Sem `any` sem justificativa em comentário.
- Cálculo de taxas e agregações fica em `lib/metrics` como funções puras, com teste unitário. Componentes não calculam métricas.
- Mapeadores em `lib/ghl` isolam o formato do GHL. O resto do código só conhece o modelo próprio.
- Datas em UTC no banco. Conversão para o fuso da clínica só na camada de apresentação e nos limites do período.
- Textos da interface em português, diretos, sem linguagem rebuscada.
- Migrations: nunca editar uma já aplicada, criar uma nova.
- Next.js 16 com `cacheComponents` ligado: leitura de `searchParams`, `cookies()` e consultas ao banco ficam dentro de `<Suspense>` (padrão em `login/page.tsx` e `(app)/page.tsx`). Antes de usar uma API do Next, ler a doc em `node_modules/next/dist/docs`, porque a versão tem mudanças (ex: `middleware` virou `proxy`).
- Desempenho (23/10/2026): cada carga do dashboard fazia ~13 consultas separadas ao banco por período (24 com dois períodos). Agora `getDashboardData` chama a função SQL `dashboard_resumo` (migration `20261023000002_dashboard_resumo.sql`), que devolve todos os números do período numa só ida ao banco, com as mesmas regras de `getDashboardDataLegacy`. Se a função não existir (erro `PGRST202`), cai no caminho antigo e não tenta a função de novo por 5 minutos. **Qualquer mudança em regra de contagem tem de ser feita nos dois lugares** (SQL e `getDashboardDataLegacy`), ou o legado deve ser removido depois de a função estar em produção. A função foi validada contra o código antigo em 8 combinações de mês e vendedor num Postgres descartável com cópia dos dados reais.
- Aviso de carregamento: `components/navegacao.tsx` (`NavegacaoProvider`, em `app-shell`) marca como pendente as navegações que trocam os números (filtro de período, abas de vendedor), mostra uma barra no topo e esmaece o `main` depois de 150 ms (CSS `.nav-progress` e `body[data-navegando] main` em `globals.css`). Use `useNavegar().navegar` em vez de `router.push` nesses casos; sem isso a tela fica parada com os números antigos e parece travada.
- Login nas navegações: `proxy.ts` e `loadMetas` usam `supabase.auth.getClaims()`, que confere a assinatura do token localmente (as chaves do projeto são ES256), em vez de `getUser()`, que vai ao Supabase Auth e custa cerca de 100 ms por navegação. Contrapartida: um logout feito em outro lugar só vale quando o token expira (1 hora). `/api/sync`, que grava com a service role, continua com `getUser()`. Páginas buscam em paralelo (`Promise.all`) e têm esqueleto de carregamento no `<Suspense>`.
- Nunca colocar valores reais em `.env.example`. Segredos só em `.env.local`.
- Toda mudança em regra de contagem, fonte de dado, período, meta ou layout deve atualizar também `docs/documentacao-dashboard.html` (capítulos 7 a 11, em especial o 11, "Do dado à tela", e o histórico no capítulo 19).

## 4. Autenticação com a API do GHL

- API v2, base `https://services.leadconnectorhq.com`.
- Autenticação por Private Integration Token gerado na sub-conta (location) da clínica. Enviar como `Authorization: Bearer <token>`, mais o header `Version` exigido pelo endpoint.
- Variáveis de ambiente, somente servidor:
  - `GHL_TOKEN`
  - `GHL_LOCATION_ID`
  - `GHL_VENDEDORES_IDS` (ids de usuário do GHL, separados por vírgula; o primeiro é o vendedor padrão)
- Nunca hardcodar token, nunca usar prefixo `NEXT_PUBLIC_` nele, nunca logar o valor.
- `.env.local` no `.gitignore`. `.env.example` lista os nomes sem valores.
- Variáveis do Supabase: `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_ANON_KEY` (o app só as lê no servidor, em tempo de execução) e `SUPABASE_SERVICE_ROLE_KEY` (somente servidor, usada pelo sync para gravar).
- Rate limit: paginar sempre, respeitar `429` com backoff exponencial, e limitar requisições concorrentes. O botão de atualizar deve bloquear cliques repetidos enquanto um sync roda.

## 5. Mapa de endpoints do GHL

Confirmar caminho, parâmetros e `Version` na documentação da API v2 antes de implementar cada um.

| Endpoint | Alimenta | Uso no dashboard |
| --- | --- | --- |
| `opportunities/search` | Bloco 1 | Vendas (ganhas), tipo consulta/tratamento, valor, datas de criação e fechamento |
| Contatos (`contacts`) | Bloco 1 | Cadastro de contatos (tipo da venda, responsável). Desde 22/10/2026 NÃO é a fonte de Leads |
| Calendário (eventos/agendamentos) | Bloco 1 | Consultas agendadas e comparecimentos (status do evento) |
| `payments/transactions` | Bloco 1 | Faturamento em tratamentos (campo da oportunidade); o de consultas vem do calendário |
| Usuários (`users`) | Bloco 1 e fase 2 | Responsáveis (e atividades na fase 2) |

Fluxo do sync: buscar no GHL, mapear, gravar por upsert no Supabase (chave = id do GHL), registrar data e resultado da última sincronização.

## 6. Regras de negócio

**Funil**

| Etapa | Definição |
| --- | --- |
| Leads | Oportunidades criadas no período no pipeline do funil (`PIPELINE_FUNIL`) |
| Leads qualificados | Oportunidades do pipeline do funil marcadas como MQL |
| Consultas agendadas | Eventos de calendário criados no período |
| Comparecimentos | Eventos com status "compareceu" |
| Vendas | Oportunidades ganhas ou pedidos pagos no período |

**Como cada número é contado no banco** (implementado em `src/lib/dashboard/queries.ts`)

- Pipeline do funil (decisão de 22/10/2026): `PIPELINE_FUNIL` em `src/lib/ghl/config.ts`, padrão `Qualificação ( IA )` (nome exato do GHL, com espaços nos parênteses), sobrescrevível por `GHL_PIPELINE_FUNIL`. Leads, leads qualificados e vendas contam só oportunidades desse pipeline; se o nome mudar no GHL, os números caem para zero até a variável ser ajustada.
- Leads: oportunidades do pipeline do funil com `criado_em` no período (conta oportunidades, não pessoas). Não é o número de contatos: em out/2026 são 118 oportunidades contra 145 contatos criados.
- Leads qualificados: oportunidades do pipeline do funil com `mql` e `criado_em` no período.
- Consultas agendadas: agendamentos não cancelados com `criado_em` no período.
- Comparecimentos: agendamentos com status `compareceu` e `criado_em` no período.
- Vendas: oportunidades `ganha` do pipeline do funil com `criado_em` no período. `valor` é o `monetaryValue`.
- Faturamento (decisão de 23/10/2026, **não é a soma das vendas nem o valor das oportunidades**): **em consultas** = `(agendadas − comparecidas) × 160 + comparecidas × 320` (`faturamentoConsultas` em `lib/metrics/faturamento.ts`, valores em `VALOR_CONSULTA` de `lib/ghl/config.ts`, sobrescrevíveis por `VALOR_CONSULTA_AGENDADA` e `VALOR_CONSULTA_COMPARECIDA`). Usa as MESMAS contagens de Consultas agendadas (não canceladas) e Comparecimentos, ou seja, agendamentos do calendário com `criado_em` no período; o valor de comparecida SUBSTITUI o de agendada (equivale a agendadas × 160 + comparecidas × 160); no-show continua valendo 160. Filtro de vendedor pelo responsável do evento. **Em tratamentos** = soma de `oportunidades.valor_tratamento` (campo personalizado `Valor do tratamento`, id `s9irWLPUo1HwtXBM7pni`, sobrescrevível por `GHL_FIELD_VALOR_TRATAMENTO_ID`) das oportunidades do pipeline do funil com `criado_em` no período. **Total** = consultas + tratamentos. Atenção: consultas que existem só como oportunidade na etapa "Consulta Agendada", sem evento no calendário, não entram (em set/2026 são 8 oportunidades e 1 agendamento). A tela avisa o motivo de cada zero (`avisosFaturamento` em `(app)/page.tsx`). A função SQL `dashboard_resumo` ainda devolve `consultas_valor` (soma de valores de oportunidade), mas o código ignora esse campo.
- Regra do período (decisão de 21/10/2026): **todos** os números do funil usam a data "Criado em" do próprio registro no GHL (contato, oportunidade e agendamento). Consequência: uma venda ganha hoje de uma oportunidade criada em agosto conta em agosto, e o mês atual tende a subestimar vendas e faturamento. `fechado_em` e `data_inicio` continuam gravados, mas não entram nas contagens.
- Período: fuso fixo de Brasília (-03:00). Mês atual por padrão, ou intervalo `de` e `ate`. Atalhos: mês atual, mês anterior, últimos 7 e últimos 30 dias.
- Cada bloco tem o próprio filtro de período, com parâmetros próprios na URL: `meta_mes`, `meta_de`, `meta_ate` (Realizado vs. metas) e `vendas_mes`, `vendas_de`, `vendas_ate` (funil, meta de faturamento, taxas e números de vendas; o seletor fica no cartão Meta de faturamento). Componente: `src/components/period-filter.tsx`.
- Meta de um período = soma das metas dos meses que o período toca, cada uma multiplicada pela fração de dias do mês dentro do período (`metaPesos` em `src/lib/metrics/period.ts`). Mês inteiro pesa 1. Exemplo: últimos 30 dias, atravessando dois meses, usa parte da meta de cada mês. Decisão de 16/10/2026, para que atalhos que não fecham um mês também tenham meta. Mês sem meta cadastrada não entra na soma.

**Taxas** (calculadas por nós, a API não entrega)

- Taxa de qualificação = leads qualificados / leads
- Taxa de agendamento = consultas agendadas / leads qualificados (decisão de 22/10/2026; antes era sobre os leads)
- Taxa de agendamento sobre os leads = consultas agendadas / leads (`Rates.agendamentoLead`). Aparece no funil (balão à esquerda com uma seta curva de Leads até Consultas agendadas, `ArrowSpan` em `goal-funnels.tsx`), na página de Metas (somente leitura, não calcula etapas) e num cartão do bloco de taxas ("Taxa de agendamento de leads"; o cartão da taxa sobre os qualificados chama-se "Taxa de agendamento de MQL")
- Taxa de comparecimento = comparecimentos / consultas agendadas
- Taxa de conversão na consulta = vendas / comparecimentos

Se o denominador for zero, a taxa é "sem dados" (não 0%). Exibir "-" no lugar do número.

**Números de vendas**: vendas, consultas novas e tratamentos novos. Desde 23/10/2026 (`contagemConsultas` em `queries.ts`, `contaGanhas` em `lib/metrics/faturamento.ts`): **consultas novas** = oportunidades do pipeline do funil com `criado_em` no período e `estagio_id` em `ETAPAS_CONSULTA_IDS` (Consulta Agendada e Pós consulta), qualquer status; **tratamentos novos** = dessas, as com status `ganha` (consulta feita e convertida em tratamento); **vendas** = todas as `ganha` do pipeline criadas no período. Os três não somam entre si. Usam a etapa atual da oportunidade. Conferido contra o GHL em out, set, ago e jul/2026.

**Metas (Bloco 3)**

- Formulário (página `/metas`, componente `metas-form`): cartões de faturamento (Em consultas, Em tratamentos, Total e Consultas novas, este em quantidade; reordenáveis por arrastar e soltar com `SortableCards`, ordem em `localStorage` `metas:ordem:faturamento`) e funil IDEAL / METAS editável (`metas-funnel`), no formato do dashboard. A caixa "Como funciona" acima do funil é recolhível (`CaixaExplicacao` em `metas-form`, estado em `localStorage` `metas:explicacao:recolhida`, lido por `useSyncExternalStore`, vale para os dois modos). Dois modos explícitos, escolhidos num seletor: **Automático** (digita Leads e as 4 taxas; as outras 4 etapas são calculadas e ficam somente leitura) e **Manual** (digita cada etapa; as taxas são só leitura). Mês sem metas do funil abre em Automático; mês com metas salvas abre em Manual (`modoInicial`), para não recalcular o que foi salvo. Lógica pura em `src/lib/metas-edit.ts` (`editar(estado, campo, texto, modo)`, `taxasDe`, `modoInicial`, com testes). Automático: editar Leads ou uma taxa recalcula as etapas dependentes (arredondadas para inteiro). Nos dois modos o total do faturamento é a soma de consultas e tratamentos (pode ser ajustado à mão). Taxas usam as fórmulas do dashboard (qualificação sobre os leads; agendamento sobre os leads qualificados, então no modo Automático as consultas agendadas = qualificados × taxa de agendamento). O balão `agend. sobre leads` à esquerda do funil é só leitura (`agendamentoSobreLeads`). Só os 9 valores vão para o banco; as taxas nunca são salvas. Campo em branco nunca dispara cálculo.
- Uma meta por métrica e por mês (restrição única no banco): leads, leads qualificados, consultas agendadas, comparecimentos, vendas, consultas novas (quantidade), faturamento em consultas, faturamento em tratamentos, faturamento total.
- Editáveis a qualquer momento.
- Meses fechados preservam o histórico meta vs. realizado: ao fechar o mês, gravar um snapshot da meta e do realizado. Editar a meta depois não altera o snapshot.
- Indicador por métrica: abaixo da meta, na meta, acima da meta. Os limiares ficam em constante única em `src/lib/metrics/status.ts`. Valores provisórios: abaixo de 95% é "abaixo", de 95% a 105% é "na meta", a partir de 105% é "acima". Confirmar com o cliente piloto.

**Definições fechadas (levantamento na location piloto, 16/10/2026)**

- MQL: campo de oportunidade `TRAQ MQL` (checkbox, id `MVQhUw5Vxr7PVviLr39u`). Marcado vem como `fieldValueArray: ["MQL"]`. Lead qualificado = oportunidade com esse campo marcado. Hoje: 46 oportunidades marcadas.
- Comparecimento: status do evento de calendário (`appointmentStatus`). Hoje a equipe não marca "compareceu"; só aparecem `confirmed` e `noshow`. Confirmar com o cliente o valor exato do status de comparecimento e treinar a equipe a marcá-lo, senão a taxa de comparecimento sai zerada.
- Tipo de venda (**substituído em 23/10/2026**): antes, contato com `data_inicio_tratamento` (id `gs5tLZ5CXwb1HjXFBsyy`) preenchida era venda de tratamento. O painel não usa mais isso: consultas novas e tratamentos novos vêm das etapas do pipeline. A coluna `oportunidades.tipo` e o campo do contato ainda são sincronizados, mas não alimentam nenhum número.
- Pessoas (16/10/2026): Eva Borges é a dona da clínica e só acompanha o dashboard. Gabriela Gonçalves é a vendedora. Os demais usuários do GHL são administradores da Mindsight e não são vendedores.
- Dono da venda: o responsável (`assignedTo`) da oportunidade. Leads (que são oportunidades do pipeline do funil) usam o responsável da oportunidade e agendamentos o do evento.
- Registro sem responsável no GHL conta para o vendedor padrão, que é o primeiro id de `GHL_VENDEDORES_IDS` (Gabriela). Motivo: o agente de IA só repassava a venda para ela e não será mais usado, e hoje 30 das 31 vendas ganhas não têm responsável. A atribuição é só no dashboard (`responsavel_padrao = true`); nada é escrito no GHL. Quando o cliente passar a atribuir responsáveis no GHL, o valor do GHL prevalece.
- Metas por vendedor: `metas.usuario_id`, com `'clinica'` para a meta geral. Vendedor selecionado usa só as metas dele; "Clínica toda" usa as gerais.
- Pipeline do funil: só `Qualificação ( IA )` (ver regra de 22/10/2026 acima). Os outros (`Clientes da base`, `Geladeira ...`, `Reativação de leads`) ficam fora de leads, qualificados e vendas. Consultas agendadas e comparecimentos seguem contando agendamentos de qualquer contato.
- Faturamento: `payments/transactions` retorna vazio nesta location. O faturamento usa o valor da oportunidade (consultas) e o campo Valor do tratamento (tratamentos), datados pelo `criado_em` (regras de 21 e 23/10/2026; antes era a soma das vendas ganhas por `lastStatusChangeAt`).

**Lacunas de dados no GHL (bloqueiam números do Bloco 1)**

- `data_inicio_tratamento` está vazia nos contatos com venda ganha, mas deixou de importar para o painel (ver Tipo de venda acima). Existem os campos de oportunidade `Valor do tratamento` (usado no faturamento em tratamentos) e `O paciente fechou o tratamento?`, usados em poucas oportunidades.
- Status de comparecimento no calendário, como descrito acima.
- Campo `Valor do tratamento` na oportunidade (monetário): preenchido em 2 oportunidades. Sem ele, o faturamento em tratamentos fica em zero.
- A coluna `oportunidades.valor_tratamento` vem da migration `20261023000001_valor_tratamento.sql`. Enquanto não for rodada, o sync segue sem gravar o campo e o dashboard mostra o faturamento em tratamentos como indisponível. Depois de rodar a migration, clicar em Atualizar dados.
- Atividade comercial (fase 2): o que conta (ligação, WhatsApp, e-mail, tarefa, nota).

Não inventar valores para suprir essas lacunas: mostrar "sem dados" até o GHL estar preenchido.

## 7. Modelo de dados

| Entidade | Campos principais |
| --- | --- |
| Contato | id, nome, origem, data de criação, status de qualificação |
| Oportunidade | id, contato, pipeline, estágio, tipo (consulta/tratamento), valor, status (aberta/ganha/perdida), data de criação, data de fechamento |
| Agendamento | id, contato, data, status (agendado/compareceu/não compareceu/cancelado) |
| Transação | id, oportunidade, valor, data, status de pagamento |
| Usuário | id, nome, papel, ativo, vendedor (marcado por `GHL_VENDEDORES_IDS`) |
| Meta | id, métrica, mês de referência, valor, `usuario_id` (única por métrica, mês e usuário; `'clinica'` é a geral) |
| Fechamento de mês | mês, métrica, meta e realizado congelados no fechamento |
| Sync | id, início, fim, status, erro, contagem de registros por entidade |
| Atividade (fase 2) | id, contato, tipo, data, responsável |

Sem tabela de clínica: o `location_id` e o token do GHL ficam em variáveis de ambiente, e o nome da clínica em `NEXT_PUBLIC_CLINIC_NAME`. RLS ativo em todas as tabelas, liberando acesso só a usuários autenticados. Se uma tabela de estágios de pipeline for necessária, ela entra só depois de fechada a convenção de consulta vs. tratamento.

## 8. Padrões visuais

- Design system: `src/Boltshift-System-V2.html` (referência visual, não é código do app). Usamos o layout e a escala dele (Inter, fundo `#F6F7F9`, cartões brancos de 20px com sombra suave, 24 a 32px de respiro, pílulas, barras listradas, gauge semicircular de 12 segmentos, movimento de 200ms a 800ms) com as cores Mindsight no lugar do violeta e do laranja do Boltshift. Decisão do usuário em 16/10/2026.
- Cores Mindsight: ciano `#00BCD4` e `#0FC8D8`, azul-marinho escuro `#1A1A2E`. Definir como tokens em `globals.css`, sem hex solto nos componentes. Ciano não vai como texto sobre branco (contraste baixo): para texto usar `brand-ink` (`#00727F`).
- Cores de status: abaixo `#EF4444`, na meta `#F59E0B`, acima `#10B981`, cada uma com fundo claro e texto escuro para a pílula.
- Calendário do filtro de período (react-day-picker): o tema fica em `globals.css` sob `.card .rdp-root`. O seletor precisa ser mais específico que `.rdp-root` porque o CSS da biblioteca (azul padrão) carrega depois do nosso. Não sobrescrever `--rdp-range_start-background` e `--rdp-range_end-background`: são os gradientes que ligam o intervalo; a cor do círculo é `--rdp-range_start-date-background-color` e `--rdp-range_end-date-background-color`.
- Classes de componente em `globals.css`: `.card`, `.card-dark`, `.input`, `.btn` (`btn-primary`, `btn-dark`, `btn-ghost`) e `.bar-fill` (barra listrada, cor por `bar-brand`, `bar-abaixo`, `bar-na_meta`, `bar-acima`, `bar-sem_meta`).
- Menu lateral (mantido por decisão do cliente em 20/10/2026; uma remoção feita em 19/10 foi desfeita): `components/app-shell.tsx` tem a clínica no alto, Dashboard e Metas no meio e Sair embaixo; em telas pequenas vira uma barra no topo. Dashboard (`/`) e Metas (`/metas`) são páginas próprias, e `nav-links.tsx` marca a ativa. Metas já foi um popup (19/10) e voltou a ser página em 20/10. A página carrega com `loadMetas` e grava por server action (`saveMetas`, em `src/lib/metas-actions.ts`); pergunta antes de descartar alterações e avisa ao fechar a aba com alterações não salvas. O cabeçalho da tela (`page-header`) leva só o título, o subtítulo e a ação da tela (Atualizar dados).
- Ordem do dashboard (nova referência em 19/10/2026): título e botão Atualizar dados; filtro de vendedor à esquerda e filtro de período `meta_*` à direita; Faturamento (3 cartões: em consultas, em tratamentos e total, com o total em destaque); Realizado vs. metas (dois funis em trapézios lado a lado, REALIZADO e IDEAL / METAS, com setas curvas e balões de taxa entre as etapas); Taxas de cada etapa do funil (5 cartões com anel de progresso, com filtro `vendas_*`: qualificação, agendamento de MQL, agendamento de leads, comparecimento e conversão; os 5 ficam numa linha só a partir de 1536 px, o breakpoint `2xl`, e abaixo disso em 2 colunas e depois 1. O `RateCard` usa container query (`@container`, `@max-[330px]:`) e fica compacto quando estreito. Não usar `min-[Npx]:` para sobrescrever `xl:`: o Tailwind coloca a regra do `xl` depois e ela vence); Números de vendas (Vendas com meta, consultas novas e tratamentos novos). O formato do funil é ilustrativo: a largura das etapas é fixa, não proporcional aos números. Os balões de taxa da direita ficam centrados na curva da sua seta (sobem `RATE_CHIP_RISE` px em relação ao centro da divisória entre as etapas); medir antes de mexer nessas posições. As taxas do funil IDEAL são calculadas sobre as metas (`funnelRatesFromGoals`).
- Componentes do dashboard em `src/components`: `app-shell` (menu lateral), `nav-links` (itens do menu), `page-header` (título e ação da tela), `metas-form` e `metas-funnel` (página de metas), `goal-card`, `goal-funnels`, `rate-card`, `status-pill`, `info-tip`, `period-filter`, `vendedor-tabs`, `sync-button`, `sortable-cards`. As etapas do funil destacam-se ao passar o mouse (linha e brilho ciano, e a mesma etapa nos dois funis acende junto); o brilho fica numa camada separada do conteúdo (`.stage-fx`) porque `filter` em um ancestral quebraria o balão do "!" (position fixed). Os cartões de Faturamento podem ser reordenados por arrastar e soltar (dnd-kit, também por teclado e toque); a ordem fica em `localStorage` (`dashboard:ordem:faturamento`), por navegador, e há botão para restaurar o padrão. Só entram no menu telas que existem.
- Sem em-dash em textos da interface. Sem excesso de emoji.
- Realizado vs. meta comunica status visualmente (cor e ícone ou barra de progresso), não só em texto. Não depender só de cor.
- Todo número exibido se liga a um objetivo de negócio (faturamento, vendas). Nada de métrica solta de engajamento.
- Toda métrica exibida tem um "!" (`InfoTip`) explicando o que ela mede. Os textos ficam em `src/lib/metrics/help.ts` e devem ser atualizados junto com `src/lib/dashboard/queries.ts` quando uma regra de contagem mudar.
- Estados obrigatórios em toda tela de dados: carregando, vazio e erro.
- Mostrar a data e hora da última atualização dos dados perto do botão "Atualizar dados".

## 9. Checklist mínimo antes de concluir uma milestone

- [ ] `tsc` e lint sem erros
- [ ] Testes das funções de `lib/metrics` passando, incluindo denominador zero
- [ ] Sync executado contra a location piloto sem erro e sem duplicar registros ao rodar duas vezes
- [ ] Números conferidos manualmente contra o GHL em pelo menos um período
- [ ] Token do GHL ausente do bundle do cliente e dos logs
- [ ] Estados de carregando, vazio e erro verificados na tela
- [ ] Texto da interface sem em-dash
- [ ] Este CLAUDE.md revisado e atualizado se algo mudou

## 10. Riscos

- Campos de modelagem (MQL, consulta vs. tratamento) não criados a tempo no GHL atrasam o Bloco 1 inteiro.
- Rate limit do GHL em syncs grandes. Mitigação: paginação, backoff, sync incremental por data de atualização quando a API permitir.
