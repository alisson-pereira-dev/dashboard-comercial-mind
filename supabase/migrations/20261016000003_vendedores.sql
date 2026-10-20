-- Vendedores: usuarios do GHL, responsavel de cada registro e metas por vendedor.

create table public.usuarios (
  id text primary key,
  nome text not null,
  papel text,
  ativo boolean not null default true,
  -- Quem aparece no filtro de vendedor (definido por GHL_VENDEDORES_IDS no sync).
  vendedor boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger usuarios_set_updated_at before update on public.usuarios
  for each row execute function public.set_updated_at();

alter table public.usuarios enable row level security;
create policy "leitura autenticados" on public.usuarios
  for select to authenticated using (true);

-- Responsavel de cada registro. responsavel_padrao = true quando o GHL nao tinha
-- responsavel e o sync atribuiu o vendedor padrao.
alter table public.contatos
  add column responsavel_id text,
  add column responsavel_padrao boolean not null default false;
alter table public.oportunidades
  add column responsavel_id text,
  add column responsavel_padrao boolean not null default false;
alter table public.agendamentos
  add column responsavel_id text,
  add column responsavel_padrao boolean not null default false;

create index contatos_responsavel_idx on public.contatos (responsavel_id);
create index oportunidades_responsavel_idx on public.oportunidades (responsavel_id);
create index agendamentos_responsavel_idx on public.agendamentos (responsavel_id);

-- Metas por vendedor. usuario_id = 'clinica' e a meta geral da clinica.
alter table public.metas add column usuario_id text not null default 'clinica';

do $$
declare
  c text;
begin
  select conname into c
  from pg_constraint
  where conrelid = 'public.metas'::regclass and contype = 'u' and array_length(conkey, 1) = 2;
  if c is not null then
    execute format('alter table public.metas drop constraint %I', c);
  end if;
end $$;

alter table public.metas
  add constraint metas_metrica_mes_usuario_key unique (metrica, mes_referencia, usuario_id);
