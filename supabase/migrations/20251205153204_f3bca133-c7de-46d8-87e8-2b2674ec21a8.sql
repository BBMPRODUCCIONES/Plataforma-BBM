-- ============================================
-- PLAN DE SEGURIDAD COMPLETO - RLS RESTRICTIVAS
-- ============================================

-- 1. TABLA EMPLOYEES - Restringir a admin y operativo
DROP POLICY IF EXISTS "Authenticated users can view employees" ON employees;

CREATE POLICY "Admins and operativos can view employees"
ON employees FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'administrador'::app_role) OR 
  has_role(auth.uid(), 'operativo'::app_role)
);

-- 2. TABLA SUPPLIERS - Restringir a admin y operativo
DROP POLICY IF EXISTS "Authenticated users can view suppliers" ON suppliers;

CREATE POLICY "Admins and operativos can view suppliers"
ON suppliers FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'administrador'::app_role) OR 
  has_role(auth.uid(), 'operativo'::app_role)
);

-- 3. TABLA PROJECTS - Acceso basado en rol (admin, operativo, visual)
DROP POLICY IF EXISTS "Authenticated users can view all projects" ON projects;

CREATE POLICY "Role-based project access"
ON projects FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'administrador'::app_role) OR 
  has_role(auth.uid(), 'operativo'::app_role) OR
  has_role(auth.uid(), 'visual'::app_role)
);

-- 4. TABLA CLIENTS - Restringir a admin y operativo
DROP POLICY IF EXISTS "Authenticated users can view all clients" ON clients;

CREATE POLICY "Admins and operativos can view clients"
ON clients FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'administrador'::app_role) OR 
  has_role(auth.uid(), 'operativo'::app_role)
);

-- 5. FUNCIÓN SEGURA PARA VALIDACIÓN DE TOKENS DE INVITACIÓN
CREATE OR REPLACE FUNCTION public.validate_invitation_by_token(_token uuid)
RETURNS TABLE (
  email text,
  role app_role,
  allowed_panels text[]
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT email, role, allowed_panels
  FROM public.invitations
  WHERE token = _token
    AND expires_at > now()
    AND accepted_at IS NULL
$$;