-- Agregar columna para notas de cotización del proveedor
ALTER TABLE projects ADD COLUMN notas_cotizacion_proveedor text NOT NULL DEFAULT '';

-- Agregar columna para archivos de cotizaciones del proveedor (JSONB)
ALTER TABLE projects ADD COLUMN cotizaciones_proveedor jsonb NOT NULL DEFAULT '[]'::jsonb;