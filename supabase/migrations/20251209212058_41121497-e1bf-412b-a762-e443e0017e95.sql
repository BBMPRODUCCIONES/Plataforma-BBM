-- Add granular feedback permission columns to user_roles table
ALTER TABLE public.user_roles 
ADD COLUMN IF NOT EXISTS puede_ver_feedback BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS puede_editar_feedback BOOLEAN DEFAULT false;

-- Set default permissions based on role for existing users
-- Administradores get full access
UPDATE public.user_roles 
SET puede_ver_feedback = true, puede_editar_feedback = true 
WHERE role = 'administrador';

-- Operativo and Visual get no access by default (can be enabled individually)
UPDATE public.user_roles 
SET puede_ver_feedback = false, puede_editar_feedback = false 
WHERE role IN ('operativo', 'visual');