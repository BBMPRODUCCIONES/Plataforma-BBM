-- Add 'otro_comentario' column to horarios table for the "Otro" category
ALTER TABLE public.horarios ADD COLUMN IF NOT EXISTS otro_comentario TEXT;