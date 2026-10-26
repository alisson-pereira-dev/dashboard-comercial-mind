-- Base de data de cada etapa do funil (26/10/2026). RODE DEPOIS da 20261026000001 e ANTES de implantar o app.
--
-- Antes, todos os numeros usavam a data "Criado em". Agora:
--   Leads e Leads qualificados  -> oportunidades.criado_em
--   Consultas agendadas         -> oportunidades que ESTAO na etapa "Consulta Agendada", pela data da ultima
--                                  mudanca de etapa (nova coluna etapa_alterada_em, lastStageChangeAt do GHL)
--   Comparecimentos             -> agendamentos "compareceu", pela data de atualizacao do agendamento
--                                  (agendamentos.atualizado_em_ghl, dateUpdated do GHL)
--   Vendas                      -> oportunidades ganhas, pela data em que foram marcadas como ganhas
--                                  (oportunidades.fechado_em, lastStatusChangeAt do GHL)
-- Os numeros derivados seguem: Em tratamentos, Tratamentos novos e os Fechamentos usam a data de ganho;
-- Consultas novas continua por criado_em.
--
-- A coluna etapa_alterada_em nasce vazia: clique em "Atualizar dados" no app depois de rodar esta migration
-- para o sync preenche-la. Ate la, Consultas agendadas aparece como zero.
--
-- A funcao ganha 'versao' = 2 no resultado; o app recusa uma versao anterior da funcao para nunca mostrar
-- numeros calculados com a regra antiga.
--
-- security invoker: roda com as permissoes de quem chama, entao o RLS continua valendo.
alter table public.oportunidades add column if not exists etapa_alterada_em timestamptz;
create index if not exists oportunidades_etapa_alterada_em_idx on public.oportunidades (etapa_alterada_em);
create index if not exists oportunidades_fechado_em_idx on public.oportunidades (fechado_em);
create index if not exists agendamentos_atualizado_em_ghl_idx on public.agendamentos (atualizado_em_ghl);

-- Versoes anteriores (6 argumentos, da 20261023000002/3). A de 8 argumentos e substituida abaixo.
drop function if exists public.dashboard_resumo(timestamptz, timestamptz, text, text, text[], date[]);

create or replace function public.dashboard_resumo(
  p_inicio timestamptz,
  p_fim timestamptz,
  p_vendedor text,         -- null = clinica toda
  p_pipeline text,         -- pipeline do funil
  p_etapas text[],         -- ids das etapas de consulta (Consulta Agendada e Pos consulta)
  p_etapa_consulta text,   -- id da etapa "Consulta Agendada"
  p_etapa_followup text,   -- id da etapa "Pos consulta"
  p_meses date[]           -- meses (dia 1) que o periodo toca, para as metas
)
returns jsonb
language sql
stable
security invoker
set search_path = public
as $$
  with
  opp as (
    select * from public.oportunidades
    where pipeline_nome = p_pipeline
      and (p_vendedor is null or responsavel_id = p_vendedor)
  ),
  -- Oportunidades criadas no periodo (leads, qualificados, consultas novas)
  criadas as (
    select * from opp where criado_em >= p_inicio and criado_em < p_fim
  ),
  -- Oportunidades marcadas como ganhas no periodo (vendas, tratamentos, fechamentos)
  ganhas as (
    select * from opp
    where status = 'ganha' and fechado_em >= p_inicio and fechado_em < p_fim
  ),
  -- Oportunidades que mudaram para a etapa Consulta Agendada no periodo (e ainda estao nela)
  agendadas as (
    select * from opp
    where estagio_id = p_etapa_consulta
      and etapa_alterada_em >= p_inicio and etapa_alterada_em < p_fim
  ),
  -- Agendamentos marcados como compareceu no periodo
  comp as (
    select * from public.agendamentos
    where status = 'compareceu'
      and atualizado_em_ghl >= p_inicio and atualizado_em_ghl < p_fim
      and (p_vendedor is null or responsavel_id = p_vendedor)
  )
  select jsonb_build_object(
    'versao', 2,
    'leads', (select count(*) from criadas),
    'leads_qualificados', (select count(*) from criadas where mql),
    'consultas_agendadas', (select count(*) from agendadas),
    'comparecimentos', (select count(*) from comp),
    'vendas', (select count(*) from ganhas),
    'vendas_valor', coalesce((select sum(valor) from ganhas), 0),
    'vendas_padrao', (select count(*) from ganhas where responsavel_padrao),
    'leads_padrao', (select count(*) from criadas where p_vendedor is not null and responsavel_padrao),
    'consultas_n', (select count(*) from criadas where estagio_id = any(p_etapas)),
    'consultas_ganhas', (select count(*) from ganhas where estagio_id = any(p_etapas)),
    'fechamentos_consulta', (select count(*) from ganhas where estagio_id = p_etapa_consulta),
    'fechamentos_followup', (select count(*) from ganhas where estagio_id = p_etapa_followup),
    'tem_dados', exists (select 1 from public.contatos),
    'metas', coalesce((
      select jsonb_agg(jsonb_build_object('metrica', metrica, 'valor', valor, 'mes_referencia', mes_referencia))
      from public.metas
      where usuario_id = coalesce(p_vendedor, 'clinica') and mes_referencia = any(p_meses)
    ), '[]'::jsonb),
    'ultimo_sync', (
      select jsonb_build_object('status', status, 'iniciado_em', iniciado_em, 'finalizado_em', finalizado_em, 'erro', erro)
      from public.sync_runs order by iniciado_em desc limit 1
    ),
    'ultimo_sync_ok', (
      select finalizado_em from public.sync_runs where status = 'ok' order by finalizado_em desc limit 1
    )
  );
$$;

revoke execute on function public.dashboard_resumo(timestamptz, timestamptz, text, text, text[], text, text, date[]) from public, anon;
grant execute on function public.dashboard_resumo(timestamptz, timestamptz, text, text, text[], text, text, date[]) to authenticated, service_role;
