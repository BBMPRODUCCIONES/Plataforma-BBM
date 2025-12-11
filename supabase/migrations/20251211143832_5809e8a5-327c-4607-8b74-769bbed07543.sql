-- Add missing banking columns to employees table
ALTER TABLE public.employees 
ADD COLUMN IF NOT EXISTS banco text NOT NULL DEFAULT '',
ADD COLUMN IF NOT EXISTS tipo_cuenta text NOT NULL DEFAULT '',
ADD COLUMN IF NOT EXISTS numero_cuenta text NOT NULL DEFAULT '';