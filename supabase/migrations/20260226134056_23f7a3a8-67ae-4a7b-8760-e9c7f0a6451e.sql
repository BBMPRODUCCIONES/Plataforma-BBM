
-- Add new columns for the 3 separate inventory responsable roles (auto-login based)
ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS inventario_responsable_salida_user_id TEXT,
  ADD COLUMN IF NOT EXISTS inventario_responsable_salida_nombre TEXT,
  ADD COLUMN IF NOT EXISTS inventario_responsable_salida_timestamp TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS inventario_responsable_entrada_user_id TEXT,
  ADD COLUMN IF NOT EXISTS inventario_responsable_entrada_nombre TEXT,
  ADD COLUMN IF NOT EXISTS inventario_responsable_entrada_timestamp TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS inventario_responsable_evento_user_id TEXT,
  ADD COLUMN IF NOT EXISTS inventario_responsable_evento_nombre TEXT,
  ADD COLUMN IF NOT EXISTS inventario_responsable_evento_timestamp TIMESTAMPTZ;
