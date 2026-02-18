
-- Add approver columns to gastos_menores
ALTER TABLE public.gastos_menores 
ADD COLUMN IF NOT EXISTS aprobado_por_id uuid,
ADD COLUMN IF NOT EXISTS aprobado_por_nombre text DEFAULT '';

-- Enable realtime for gastos_menores
ALTER PUBLICATION supabase_realtime ADD TABLE public.gastos_menores;
