-- Taxas de conversao por etapa deixam de ter base no comparecimento (27/10/2026, 2a correcao).
--
-- Antes: conversao na consulta = fechamentos em consulta / comparecimentos; conversao pos consulta =
-- fechamentos em follow up / comparecimentos. O cliente pediu que a base de cada taxa seja a PROPRIA
-- etapa (quantos leads chegaram ali), nao os comparecimentos:
--   Taxa de conversao na consulta  = fechamentos em consulta / Consultas agendadas (ja existe)
--   Taxa de conversao pos consulta = fechamentos em follow up / [oportunidades na etapa Pos consulta]
--
-- O denominador da segunda taxa nao existia: entra 'pos_consulta_n' (oportunidades do pipeline do funil
-- que ESTAO na etapa Pos consulta, pela data da ultima mudanca de etapa - mesma regra de "Consultas
-- agendadas", so que para a outra etapa). Nao confundir com 'consultas_n' (Consultas novas: criadas no
-- periodo em qualquer uma das duas etapas, por criado_em).
--
-- Mesma assinatura (8 argumentos): create or replace e suficiente, sem apagar a funcao. A funcao ganha
-- 'versao' = 4.
-- security invoker: roda com as permissoes de quem chama, entao o RLS continua valendo.
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
  -- Oportunidades que mudaram para a etapa Consulta Agendada no periodo (e ainda estao nela).
  -- Alimenta o card "Consultas agendadas" do funil E, desde 27/10/2026, a base da taxa de conversao na
  -- consulta (NAO o faturamento, que usa ag_fat abaixo, outra fonte).
  agendadas as (
    select * from opp
    where estagio_id = p_etapa_consulta
      and etapa_alterada_em >= p_inicio and etapa_alterada_em < p_fim
  ),
  -- Oportunidades que mudaram para a etapa Pos consulta no periodo (e ainda estao nela). Mesma regra de
  -- "agendadas" acima, para a outra etapa: base da taxa de conversao pos consulta.
  pos_consulta as (
    select * from opp
    where estagio_id = p_etapa_followup
      and etapa_alterada_em >= p_inicio and etapa_alterada_em < p_fim
  ),
  -- Agendamentos do calendario (nao cancelados) criados no periodo: base do "Em consultas" (faturamento).
  -- Numero independente do card "Consultas agendadas" acima (fontes diferentes: calendario x pipeline).
  ag_fat as (
    select * from public.agendamentos
    where status <> 'cancelado'
      and criado_em >= p_inicio and criado_em < p_fim
      and (p_vendedor is null or responsavel_id = p_vendedor)
  ),
  -- Agendamentos marcados como compareceu no periodo (pela data de atualizacao).
  comp as (
    select * from public.agendamentos
    where status = 'compareceu'
      and atualizado_em_ghl >= p_inicio and atualizado_em_ghl < p_fim
      and (p_vendedor is null or responsavel_id = p_vendedor)
  )
  select jsonb_build_object(
    'versao', 4,
    'leads', (select count(*) from criadas),
    'leads_qualificados', (select count(*) from criadas where mql),
    'consultas_agendadas', (select count(*) from agendadas),
    'pos_consulta_n', (select count(*) from pos_consulta),
    'faturamento_agendadas', (select count(*) from ag_fat),
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
