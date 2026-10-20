-- Estado de facturacion, aparte del estado del evento.
--
-- El campo `estado` paso de siete valores a tres (por_planear, en_progreso,
-- ejecutado) porque mezclaba dos preguntas distintas: en que va la operacion
-- y si ya se cobro. Esta columna recupera la segunda, separada, que es donde
-- siempre debio estar.
--
-- Valores:
--   sin_definir     todavia no se ha decidido (el que queda por defecto)
--   por_facturar    el evento se hizo y falta pasar la factura
--   facturado       la factura ya salio
--   no_se_factura   no genera factura: interno, cortesia, demo, o lo cubre
--                   otro contrato
--
-- Se deja como texto con CHECK y no como enum: agregar un valor a un enum en
-- Postgres obliga a una migracion aparte y no se puede hacer dentro de una
-- transaccion con otros cambios. Con CHECK es un ALTER y ya.

ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS estado_facturacion text NOT NULL DEFAULT 'sin_definir';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'projects_estado_facturacion_valido'
  ) THEN
    ALTER TABLE public.projects
      ADD CONSTRAINT projects_estado_facturacion_valido
      CHECK (estado_facturacion IN ('sin_definir', 'por_facturar', 'facturado', 'no_se_factura'));
  END IF;
END $$;

-- Para filtrar y agrupar por facturacion sin recorrer la tabla entera.
CREATE INDEX IF NOT EXISTS projects_estado_facturacion_idx
  ON public.projects (estado_facturacion);

COMMENT ON COLUMN public.projects.estado_facturacion IS
  'Si el evento ya se cobro. Es independiente de projects.estado, que dice en que va la operacion.';
