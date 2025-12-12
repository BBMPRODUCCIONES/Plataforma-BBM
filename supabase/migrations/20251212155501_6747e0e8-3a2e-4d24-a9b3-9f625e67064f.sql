-- Add photo columns to horarios table
ALTER TABLE public.horarios 
ADD COLUMN IF NOT EXISTS foto_llegada text DEFAULT '',
ADD COLUMN IF NOT EXISTS foto_salida text DEFAULT '';