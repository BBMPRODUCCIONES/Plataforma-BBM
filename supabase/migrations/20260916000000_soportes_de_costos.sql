-- Soportes de los costos del evento: facturas, recibos, cuentas de cobro.
--
-- Va aparte de projects.costos porque son dos cosas distintas: costos son las
-- lineas con su valor, y esto son los archivos que las respaldan. Mezclarlos
-- obligaria a reescribir el arreglo entero al adjuntar un papel.
ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS costos_adjuntos jsonb NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.projects.costos_adjuntos IS
  'Archivos que respaldan los costos del evento (facturas, recibos, cuentas de cobro).';
