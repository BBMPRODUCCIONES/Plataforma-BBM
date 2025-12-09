-- Add feedback columns to projects table
ALTER TABLE public.projects 
ADD COLUMN IF NOT EXISTS feedback TEXT DEFAULT '',
ADD COLUMN IF NOT EXISTS feedback_adjuntos JSONB DEFAULT '[]'::jsonb;