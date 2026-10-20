-- Schema inicial do Dashboard Comercial Mindsight (uma clinica por projeto).
-- Tabelas de dados do GHL usam o id do GHL como chave primaria (upsert idempotente).
-- Sem chaves estrangeiras entre tabelas do GHL: o sync pode trazer registros fora de ordem.
-- Escrita nessas tabelas e feita pelo servidor (service role, ignora RLS).

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Contatos (leads)
create table public.contatos (
  id text primary key,
  nome text,
  origem text,
  criado_em timestamptz not null,
  -- Criterio de MQL ainda em definicao com o cliente piloto (CLAUDE.md, secao 6).
  qualificado boolean not null default false,
  atualizado_em_ghl timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index contatos_criado_em_idx on public.contatos (criado_em);

-- Oportunidades (vendas)
create table public.oportunidades (
  id text primary key,
  contato_id text,
  pipeline_id text,
  estagio_id text,
  -- Null enquanto a convencao consulta vs. tratamento nao estiver definida.
  tipo text check (tipo in ('consulta', 'tratamento')),
  valor numeric(12, 2) not null default 0,
  status text not null check (status in ('aberta', 'ganha', 'perdida')),
  criado_em timestamptz not null,
  fechado_em timestamptz,
  atualizado_em_ghl timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index oportunidades_criado_em_idx on public.oportunidades (criado_em);
create index oportunidades_fechado_em_idx on public.oportunidades (fechado_em);
create index oportunidades_contato_idx on public.oportunidades (contato_id);

-- Agendamentos (eventos de calendario)
create table public.agendamentos (
  id text primary key,
  contato_id text,
  data_inicio timestamptz not null,
  criado_em timestamptz not null,
  status text not null check (status in ('agendado', 'compareceu', 'nao_compareceu', 'cancelado')),
  atualizado_em_ghl timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index agendamentos_criado_em_idx on public.agendamentos (criado_em);
create index agendamentos_data_inicio_idx on public.agendamentos (data_inicio);
create index agendamentos_contato_idx on public.agendamentos (contato_id);

-- Transacoes (pagamentos)
create table public.transacoes (
  id text primary key,
  oportunidade_id text,
  contato_id text,
  valor numeric(12, 2) not null,
  data timestamptz not null,
  status_pagamento text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index transacoes_data_idx on public.transacoes (data);
create index transacoes_oportunidade_idx on public.transacoes (oportunidade_id);

-- Metas (cadastradas na plataforma). mes_referencia e sempre o dia 1 do mes.
create table public.metas (
  id uuid primary key default gen_random_uuid(),
  metrica text not null check (metrica in (
    'leads',
    'leads_qualificados',
    'consultas_agendadas',
    'comparecimentos',
    'vendas',
    'faturamento_consultas',
    'faturamento_tratamentos',
    'faturamento_total'
  )),
  mes_referencia date not null check (extract(day from mes_referencia) = 1),
  valor numeric(14, 2) not null check (valor >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (metrica, mes_referencia)
);

-- Fechamento de mes: meta e realizado congelados, preservam o historico
-- mesmo que a meta seja editada depois.
create table public.fechamentos_mes (
  id uuid primary key default gen_random_uuid(),
  mes_referencia date not null check (extract(day from mes_referencia) = 1),
  metrica text not null,
  meta numeric(14, 2),
  realizado numeric(14, 2) not null,
  fechado_em timestamptz not null default now(),
  unique (metrica, mes_referencia)
);

-- Execucoes do sync (botao "Atualizar dados")
create table public.sync_runs (
  id uuid primary key default gen_random_uuid(),
  iniciado_em timestamptz not null default now(),
  finalizado_em timestamptz,
  status text not null default 'rodando' check (status in ('rodando', 'ok', 'erro')),
  erro text,
  contagens jsonb not null default '{}'::jsonb
);
create index sync_runs_iniciado_em_idx on public.sync_runs (iniciado_em desc);

-- Triggers de updated_at
create trigger contatos_set_updated_at before update on public.contatos
  for each row execute function public.set_updated_at();
create trigger oportunidades_set_updated_at before update on public.oportunidades
  for each row execute function public.set_updated_at();
create trigger agendamentos_set_updated_at before update on public.agendamentos
  for each row execute function public.set_updated_at();
create trigger transacoes_set_updated_at before update on public.transacoes
  for each row execute function public.set_updated_at();
create trigger metas_set_updated_at before update on public.metas
  for each row execute function public.set_updated_at();

-- RLS: somente usuarios autenticados.
alter table public.contatos enable row level security;
alter table public.oportunidades enable row level security;
alter table public.agendamentos enable row level security;
alter table public.transacoes enable row level security;
alter table public.metas enable row level security;
alter table public.fechamentos_mes enable row level security;
alter table public.sync_runs enable row level security;

-- Dados do GHL, fechamentos e sync: leitura para autenticados, escrita so pelo servidor.
create policy "leitura autenticados" on public.contatos
  for select to authenticated using (true);
create policy "leitura autenticados" on public.oportunidades
  for select to authenticated using (true);
create policy "leitura autenticados" on public.agendamentos
  for select to authenticated using (true);
create policy "leitura autenticados" on public.transacoes
  for select to authenticated using (true);
create policy "leitura autenticados" on public.fechamentos_mes
  for select to authenticated using (true);
create policy "leitura autenticados" on public.sync_runs
  for select to authenticated using (true);

-- Metas: autenticados leem e editam (Bloco 3, sem fluxo de aprovacao).
create policy "leitura autenticados" on public.metas
  for select to authenticated using (true);
create policy "insercao autenticados" on public.metas
  for insert to authenticated with check (true);
create policy "edicao autenticados" on public.metas
  for update to authenticated using (true) with check (true);
create policy "exclusao autenticados" on public.metas
  for delete to authenticated using (true);
