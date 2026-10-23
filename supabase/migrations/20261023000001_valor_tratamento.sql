-- Faturamento em tratamentos: campo personalizado "Valor do tratamento" da oportunidade no GHL.
-- Null = campo vazio na oportunidade. Preenchido pelo sync ("Atualizar dados").
alter table public.oportunidades add column if not exists valor_tratamento numeric(12, 2);
