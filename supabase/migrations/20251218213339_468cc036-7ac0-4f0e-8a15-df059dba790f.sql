-- Add migration tracking columns to supplier_cotizacion_history
ALTER TABLE public.supplier_cotizacion_history 
ADD COLUMN IF NOT EXISTS migrated boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS migrated_at timestamp with time zone DEFAULT NULL;

-- Create index for efficient querying of non-migrated records
CREATE INDEX IF NOT EXISTS idx_supplier_cotizacion_history_migrated 
ON public.supplier_cotizacion_history (migrated) 
WHERE migrated = false;