-- Add allowed_panels column to invitations table
ALTER TABLE public.invitations 
ADD COLUMN IF NOT EXISTS allowed_panels text[] DEFAULT ARRAY['general', 'operaciones']::text[];