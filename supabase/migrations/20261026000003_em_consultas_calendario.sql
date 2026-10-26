-- "Em consultas" (faturamento) volta a contar pelo CALENDARIO do GHL (26/10/2026), como na regra original
-- ("Etapa 1": toda consulta agendada no calendario soma R$160, compareceu substitui por R$320).
--
-- A migration anterior (20261026000002) mudou o card "Consultas agendadas" do FUNIL para contar
-- oportunidades na etapa do pipeline, pela data da mudanca de etapa. Como o faturamento reusava o MESMO
-- numero, ele passou a vir do pipeline tambem, o que conflita com a regra original do faturamento (que
-- sempre foi sobre o calendario). Esta migration desfaz so essa parte: o card "Consultas agendadas" do
-- funil CONTINUA pela etapa do pipeline; o faturamento em consultas volta a ter a sua PROPRIA contagem,
-- independente, vinda do calendario.
--
-- Entra 'faturamento_agendadas': agendamentos nao cancelados criados no periodo (a regra de antes de
-- 26/10/2026 para "Consultas agendadas", agora dedicada só ao faturamento). Os comparecimentos continuam
-- vindo do calendario pela data de atualizacao (sem mudanca, pedido explicito do cliente). A funcao ganha
-- 'versao' = 3.
--
-- Mesma assinatura (8 argumentos): create or replace e suficiente, sem apagar a funcao.
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
  -- So alimenta o card "Consultas agendadas" do funil, NAO o faturamento (ver ag_fat abaixo).
  agendadas as (
    select * from opp
    where estagio_id = p_etapa_consulta
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
    'versao', 3,
    'leads', (select count(*) from criadas),
    'leads_qualificados', (select count(*) from criadas where mql),
    'consultas_agendadas', (select count(*) from agendadas),
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
