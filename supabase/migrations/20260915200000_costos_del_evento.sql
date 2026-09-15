-- Costos del evento: quien trabajo y que proveedores se usaron, con su valor.
--
-- Se guarda como jsonb en la misma fila del proyecto, igual que personal,
-- inventario y caja_menor. No es la forma mas pura, pero es la que ya usa el
-- resto de la aplicacion: una tabla aparte obligaria a tocar el contexto, las
-- politicas y la duplicacion de eventos, y a convivir con dos maneras de hacer
-- lo mismo.
--
-- Cada linea: { id, tipo, concepto, beneficiario, beneficiarioId, valor,
--               nota, creadoEn }
ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS costos jsonb NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.projects.costos IS
  'Lineas de costo real del evento (personal, proveedores, transporte, alimentacion, produccion, otros). Alimenta la utilidad del Panel Directivo.';

-- Comprobacion: debe aparecer la columna con su valor por defecto.
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'projects' AND column_name = 'costos';
