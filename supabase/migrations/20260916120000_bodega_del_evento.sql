-- Bodega del evento: los archivos y la observacion que deja quien despacha.
--
-- Van en dos columnas y no dentro de notas porque son dos cosas con vidas
-- distintas: la remision se sube una vez y se consulta, la observacion se
-- corrige varias veces. Juntarlas obligaria a reescribir el texto cada vez
-- que se adjunta un papel.
ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS bodega_archivos jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS bodega_observaciones text;

COMMENT ON COLUMN public.projects.bodega_archivos IS
  'Archivos de bodega del evento (remisiones, listas de despacho, fotos de salida y entrada).';
COMMENT ON COLUMN public.projects.bodega_observaciones IS
  'Observaciones de bodega para el evento: novedades del despacho, faltantes, estado de los equipos.';
