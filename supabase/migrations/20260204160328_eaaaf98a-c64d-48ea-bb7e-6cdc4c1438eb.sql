-- Add legalizacion column to projects table for independent legalization data
ALTER TABLE public.projects 
ADD COLUMN IF NOT EXISTS legalizacion JSONB DEFAULT '[]'::jsonb;