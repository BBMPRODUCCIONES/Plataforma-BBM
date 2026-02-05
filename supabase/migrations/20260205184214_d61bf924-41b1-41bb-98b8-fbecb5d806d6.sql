-- Add inventory responsables fields to projects table
ALTER TABLE public.projects 
ADD COLUMN IF NOT EXISTS inventario_responsable_entradas_salidas_tipo text,
ADD COLUMN IF NOT EXISTS inventario_responsable_entradas_salidas_id uuid,
ADD COLUMN IF NOT EXISTS inventario_responsable_entradas_salidas_nombre text,
ADD COLUMN IF NOT EXISTS inventario_responsable_material_evento_tipo text,
ADD COLUMN IF NOT EXISTS inventario_responsable_material_evento_id uuid,
ADD COLUMN IF NOT EXISTS inventario_responsable_material_evento_nombre text;

-- Add comments for documentation
COMMENT ON COLUMN public.projects.inventario_responsable_entradas_salidas_tipo IS 'Type: empleado or proveedor';
COMMENT ON COLUMN public.projects.inventario_responsable_entradas_salidas_nombre IS 'Name snapshot of the responsable';
COMMENT ON COLUMN public.projects.inventario_responsable_material_evento_tipo IS 'Type: empleado or proveedor';
COMMENT ON COLUMN public.projects.inventario_responsable_material_evento_nombre IS 'Name snapshot of the responsable';