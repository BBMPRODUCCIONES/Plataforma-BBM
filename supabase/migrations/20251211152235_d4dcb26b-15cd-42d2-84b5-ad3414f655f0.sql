-- Add banking columns to suppliers table
ALTER TABLE public.suppliers
ADD COLUMN IF NOT EXISTS banco text NOT NULL DEFAULT '',
ADD COLUMN IF NOT EXISTS tipo_cuenta text NOT NULL DEFAULT '',
ADD COLUMN IF NOT EXISTS numero_cuenta text NOT NULL DEFAULT '';