-- Add allowed_panels column to user_roles table
ALTER TABLE public.user_roles 
ADD COLUMN IF NOT EXISTS allowed_panels text[] DEFAULT ARRAY['general', 'operaciones']::text[];

-- Update existing admin users to have all panels
UPDATE public.user_roles 
SET allowed_panels = ARRAY['directivo', 'general', 'operaciones', 'proveedores']::text[]
WHERE role = 'administrador';

-- Update existing operativo users to have default panels
UPDATE public.user_roles 
SET allowed_panels = ARRAY['general', 'operaciones', 'proveedores']::text[]
WHERE role = 'operativo';

-- Update existing visual users to have default panels  
UPDATE public.user_roles 
SET allowed_panels = ARRAY['general', 'operaciones']::text[]
WHERE role = 'visual';

-- Create policy for admins to update user roles (if not exists)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Service role can manage all roles'
  ) THEN
    CREATE POLICY "Service role can manage all roles"
    ON public.user_roles
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);
  END IF;
END $$;