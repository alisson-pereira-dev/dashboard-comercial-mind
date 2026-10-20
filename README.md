# Dashboard Comercial Mindsight

Dashboard de acompanhamento comercial de uma clínica: lê o GoHighLevel (somente leitura), calcula funil, taxas e realizado vs. metas, com metas cadastradas na própria plataforma. Next.js 16 + Supabase.

Contexto completo, regras de negócio e decisões: [CLAUDE.md](CLAUDE.md). Documentação para a empresa: `docs/documentacao-dashboard.html`.

## Rodar localmente

```bash
cp .env.example .env.local   # preencha os valores (nunca versione este arquivo)
npm install
npm run dev
```

Antes do primeiro uso, rode as migrations de `supabase/migrations/` no projeto Supabase, em ordem.

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

O `.dockerignore` mantém qualquer `.env` fora da imagem.

Depois de publicar: abra `/login`, entre com um usuário criado no painel do Supabase e use **Atualizar dados** (o sync leva cerca de 30 s; o proxy da VPS não deve cortar requisições antes disso).
