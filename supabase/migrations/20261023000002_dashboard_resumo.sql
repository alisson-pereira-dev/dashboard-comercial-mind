-- Resumo do dashboard em UMA chamada ao banco.
--
-- Antes, cada carga do dashboard disparava cerca de 13 consultas separadas (24 com dois periodos
-- diferentes), cada uma com a sua ida e volta pela rede. Esta funcao devolve todos os numeros de um
-- periodo de uma vez. As regras sao as mesmas de src/lib/dashboard/queries.ts (getDashboardDataLegacy),
-- que continua no codigo como reserva caso a funcao nao exista.
--
-- security invoker: roda com as permissoes de quem chama, entao o RLS continua valendo.
create or replace function public.dashboard_resumo(
  p_inicio timestamptz,
  p_fim timestamptz,
  p_vendedor text,      -- null = clinica toda
  p_pipeline text,      -- pipeline do funil
  p_etapas text[],      -- ids das etapas de consulta
  p_meses date[]        -- meses (dia 1) que o periodo toca, para as metas
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
    'vendas_padrao', (select count(*) from opp where status = 'ganha' and responsavel_padrao),
    'leads_padrao', (select count(*) from opp where p_vendedor is not null and responsavel_padrao),
    'consultas_n', (select count(*) from cons),
    'consultas_ganhas', (select count(*) from cons where status = 'ganha'),
    'consultas_valor', coalesce((select sum(greatest(valor - coalesce(valor_tratamento, 0), 0)) from cons), 0),
    'tratamento_n', (select count(*) from opp where valor_tratamento is not null),
    'tratamento_valor', coalesce((select sum(valor_tratamento) from opp where valor_tratamento is not null), 0),
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

-- So usuarios logados (e o servidor) chamam; o anonimo nao.
revoke execute on function public.dashboard_resumo(timestamptz, timestamptz, text, text, text[], date[]) from public, anon;
grant execute on function public.dashboard_resumo(timestamptz, timestamptz, text, text, text[], date[]) to authenticated, service_role;
