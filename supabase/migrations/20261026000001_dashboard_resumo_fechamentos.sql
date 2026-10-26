-- Nova versao de dashboard_resumo com os fechamentos por etapa (26/10/2026).
--
-- Entram 'fechamentos_consulta' (oportunidades GANHAS do periodo que estao na etapa "Consulta Agendada")
-- e 'fechamentos_followup' (as GANHAS que estao na etapa "Pos consulta"). As duas somam 'consultas_ganhas'
-- (os tratamentos novos). O resto da funcao e igual ao da migration 20261023000003.
--
-- A funcao ganha dois parametros (p_etapa_consulta e p_etapa_followup), entao a assinatura muda e o
-- "create or replace" nao serve: a versao antiga e removida e a nova criada. Ate esta migration rodar, o
-- app novo nao encontra a funcao (erro PGRST202) e usa o caminho antigo; depois dela, um app antigo faz o
-- mesmo. Nos dois casos os numeros continuam certos, so mais lentos.
--
-- security invoker: roda com as permissoes de quem chama, entao o RLS continua valendo.
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
      and criado_em >= p_inicio and criado_em < p_fim
      and (p_vendedor is null or responsavel_id = p_vendedor)
  ),
  cons as (select * from opp where estagio_id = any(p_etapas)),
  ag as (
    select * from public.agendamentos
    where criado_em >= p_inicio and criado_em < p_fim
      and (p_vendedor is null or responsavel_id = p_vendedor)
  )
  select jsonb_build_object(
    'leads', (select count(*) from opp),
    'leads_qualificados', (select count(*) from opp where mql),
    'consultas_agendadas', (select count(*) from ag where status <> 'cancelado'),
    'comparecimentos', (select count(*) from ag where status = 'compareceu'),
    'vendas', (select count(*) from opp where status = 'ganha'),
    'vendas_valor', coalesce((select sum(valor) from opp where status = 'ganha'), 0),
    'vendas_padrao', (select count(*) from opp where status = 'ganha' and responsavel_padrao),
    'leads_padrao', (select count(*) from opp where p_vendedor is not null and responsavel_padrao),
    'consultas_n', (select count(*) from cons),
    'consultas_ganhas', (select count(*) from cons where status = 'ganha'),
    'fechamentos_consulta', (select count(*) from opp where status = 'ganha' and estagio_id = p_etapa_consulta),
    'fechamentos_followup', (select count(*) from opp where status = 'ganha' and estagio_id = p_etapa_followup),
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
