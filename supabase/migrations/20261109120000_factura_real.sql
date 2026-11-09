-- Ventas reales: la factura del evento.
--
-- Hasta ahora las ventas salian de la cotizacion (ingreso_bruto / total) y
-- del dia de ejecucion. Eso es una venta ESTIMADA. La venta REAL es lo que se
-- facturo y el dia en que se facturo, y para contarla se exige el PDF de la
-- factura: un numero escrito a mano no basta.
--
-- num_factura sigue existiendo y es el numero que se ve en las tablas. Estas
-- columnas guardan lo que dice la factura subida.
ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS factura_fecha date,
  ADD COLUMN IF NOT EXISTS factura_subtotal numeric,
  ADD COLUMN IF NOT EXISTS factura_iva numeric,
  ADD COLUMN IF NOT EXISTS factura_total numeric,
  ADD COLUMN IF NOT EXISTS factura_archivo jsonb,
  ADD COLUMN IF NOT EXISTS factura_registrada_por text,
  ADD COLUMN IF NOT EXISTS factura_registrada_en timestamptz;

CREATE INDEX IF NOT EXISTS idx_projects_factura_fecha
  ON public.projects (factura_fecha)
  WHERE factura_fecha IS NOT NULL AND is_deleted = false;
