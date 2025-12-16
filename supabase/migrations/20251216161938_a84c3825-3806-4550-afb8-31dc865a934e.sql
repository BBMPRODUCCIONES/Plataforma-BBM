-- Add special permission for Caja Menor approval
ALTER TABLE public.user_roles 
ADD COLUMN IF NOT EXISTS puede_aprobar_caja_menor boolean DEFAULT false;

-- Add comment for documentation
COMMENT ON COLUMN public.user_roles.puede_aprobar_caja_menor IS 'Special permission to approve/disapprove Caja Menor records';