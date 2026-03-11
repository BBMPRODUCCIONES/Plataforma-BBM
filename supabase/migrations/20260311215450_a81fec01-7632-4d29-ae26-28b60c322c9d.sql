ALTER TABLE public.caja_menor_cierres 
ADD COLUMN deleted_at timestamptz DEFAULT NULL,
ADD COLUMN deleted_by text DEFAULT NULL,
ADD COLUMN deleted_by_email text DEFAULT NULL,
ADD COLUMN deleted_reason text DEFAULT NULL;