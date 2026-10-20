-- Ajustes depois do levantamento na location piloto do GHL.
-- MQL e um checkbox da oportunidade (nao do contato), e o tipo de venda
-- depende da data de inicio de tratamento, que fica no contato.

alter table public.contatos drop column qualificado;
alter table public.contatos add column data_inicio_tratamento date;

alter table public.oportunidades add column mql boolean not null default false;
alter table public.oportunidades add column pipeline_nome text not null default 'desconhecido';

create index oportunidades_status_fechado_idx on public.oportunidades (status, fechado_em);
