-- Add caja_menor column to projects table for petty cash tracking
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS caja_menor jsonb DEFAULT '[]'::jsonb NOT NULL;