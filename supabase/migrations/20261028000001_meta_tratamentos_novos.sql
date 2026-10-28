-- Nova meta: quantidade de tratamentos novos (vendas ja na etapa de consulta, no periodo).
-- A restricao da coluna metrica lista as metricas permitidas, entao e recriada com a nova.
alter table public.metas drop constraint if exists metas_metrica_check;
alter table public.metas add constraint metas_metrica_check check (metrica in (
  'leads',
  'leads_qualificados',
  'consultas_agendadas',
  'comparecimentos',
  'vendas',
  'consultas_novas',
  'tratamentos_novos',
  'faturamento_consultas',
  'faturamento_tratamentos',
  'faturamento_total'
));
