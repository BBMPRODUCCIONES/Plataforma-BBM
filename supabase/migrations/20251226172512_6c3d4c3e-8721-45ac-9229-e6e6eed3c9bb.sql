-- Add feedback column to supplier_cotizacion_history table
ALTER TABLE public.supplier_cotizacion_history
ADD COLUMN IF NOT EXISTS feedback text DEFAULT '';