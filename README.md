# Dashboard Comercial Mindsight

Dashboard de acompanhamento comercial de uma clínica: lê o GoHighLevel (somente leitura), calcula funil, taxas e realizado vs. metas, com metas cadastradas na própria plataforma. Next.js 16 + Supabase.

Contexto completo, regras de negócio e decisões: [CLAUDE.md](CLAUDE.md). Documentação para a empresa: `docs/documentacao-dashboard.html`.

## Rodar localmente

```bash
cp .env.example .env.local   # preencha os valores (nunca versione este arquivo)
npm install
npm run dev
```

Antes do primeiro uso, rode as migrations de `supabase/migrations/` no projeto Supabase, em ordem. A migration `20261023000002_dashboard_resumo.sql` cria a função que busca todos os números do dashboard de uma vez; sem ela o app funciona, só que mais devagar (cerca de 13 consultas por carga).

Verificações: `npm run typecheck`, `npm run lint`, `npm test`.

## Publicar em VPS (Docker / Easypanel)

O `Dockerfile` da raiz monta a imagem. No Easypanel, escolha **Dockerfile** como método de build (arquivo `Dockerfile`) e porta **3000**.

Variáveis de ambiente do serviço (sem espaços no início ou no fim dos valores). **Todas são lidas em tempo de execução**: não são necessárias no build, e mudar uma delas só pede reiniciar o serviço.

| Variável | Observação |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | URL do projeto Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Chave anônima (pública por natureza) |
| `NEXT_PUBLIC_CLINIC_NAME` | Nome exibido no topo (opcional) |
| `SUPABASE_SERVICE_ROLE_KEY` | Segredo. Só no servidor |
| `GHL_TOKEN` | Segredo. Token `pit-...` da sub-conta |
| `GHL_LOCATION_ID` | Id da sub-conta (location) |
| `GHL_VENDEDORES_IDS` | Ids de usuário do GHL, separados por vírgula. O primeiro é o padrão |
| `GHL_PIPELINE_FUNIL` | Opcional. Nome exato do pipeline do funil. Padrão: `Qualificação ( IA )` |
| `GHL_ETAPA_CONSULTA_AGENDADA_ID` | Opcional. Id da etapa "Consulta Agendada" do pipeline do funil (consultas novas, tratamentos novos e fechamentos em consulta). Padrão: o da clínica piloto |
| `GHL_ETAPA_POS_CONSULTA_ID` | Opcional. Id da etapa "Pós consulta" do pipeline do funil (consultas novas, tratamentos novos e fechamentos em follow up). Padrão: o da clínica piloto |
| `VALOR_CONSULTA_AGENDADA` e `VALOR_CONSULTA_COMPARECIDA` | Opcionais. Valor de cada consulta no faturamento em consultas (R$ 160 agendada, R$ 320 comparecida). Padrões: 160 e 320 |

O `.dockerignore` mantém qualquer `.env` fora da imagem.

Depois de publicar: abra `/login`, entre com um usuário criado no painel do Supabase e use **Atualizar dados** (o sync leva cerca de 30 s; o proxy da VPS não deve cortar requisições antes disso).
