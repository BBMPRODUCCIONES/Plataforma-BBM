-- Add personal_item_id column to group files by the same personal row
ALTER TABLE public.supplier_cotizacion_history 
ADD COLUMN personal_item_id text NULL;

-- Create index for faster grouping queries
CREATE INDEX idx_supplier_cotizacion_history_grouping 
ON public.supplier_cotizacion_history (evento_id, proveedor_id, personal_item_id)
WHERE deleted_at IS NULL;