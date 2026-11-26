-- "Ya cargue todos los costos": marca del productor del evento.
--
-- Es un aviso, no un cierre: la celda de Costos del Panel General se pone
-- verde para que AUX BBM sepa que ya puede revisar. El cierre sigue siendo
-- costos_verificados_en, que solo pone quien verifica.

alter table public.projects
  add column if not exists costos_completos_en timestamptz,
  add column if not exists costos_completos_por text;

comment on column public.projects.costos_completos_en is
  'Cuando el productor marco que ya cargo todos los costos del evento.';

-- La columna Costos del Panel General estaba oculta en la configuracion
-- compartida de columnas, por eso a los productores "no les salia".
update public.panel_column_configs
set columns = (
  select jsonb_agg(case when c->>'key' = 'costos' then jsonb_set(c, '{visible}', 'true') else c end order by o)
  from jsonb_array_elements(columns) with ordinality as x(c, o)
)
where panel_key = 'panel-general';
