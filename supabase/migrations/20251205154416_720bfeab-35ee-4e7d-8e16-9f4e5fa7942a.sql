-- ============================================
-- SECURITY FIX: Private Storage Bucket + Employee PII Access Control
-- ============================================

-- 1. MAKE STORAGE BUCKET PRIVATE
UPDATE storage.buckets 
SET public = false 
WHERE name = 'supplier-cotizaciones';

-- 2. ADD RLS POLICIES FOR STORAGE BUCKET
-- Drop existing policies if any
DROP POLICY IF EXISTS "Authenticated users can upload files" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can view files" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete files" ON storage.objects;

-- Create restrictive policies for supplier-cotizaciones bucket
-- Only admin and operativo can access files
CREATE POLICY "Admin and operativo can upload files"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'supplier-cotizaciones' AND
  (
    public.has_role(auth.uid(), 'administrador'::app_role) OR 
    public.has_role(auth.uid(), 'operativo'::app_role)
  )
);

CREATE POLICY "Admin and operativo can view files"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'supplier-cotizaciones' AND
  (
    public.has_role(auth.uid(), 'administrador'::app_role) OR 
    public.has_role(auth.uid(), 'operativo'::app_role)
  )
);

CREATE POLICY "Admin and operativo can update files"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'supplier-cotizaciones' AND
  (
    public.has_role(auth.uid(), 'administrador'::app_role) OR 
    public.has_role(auth.uid(), 'operativo'::app_role)
  )
);

CREATE POLICY "Admin and operativo can delete files"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'supplier-cotizaciones' AND
  (
    public.has_role(auth.uid(), 'administrador'::app_role) OR 
    public.has_role(auth.uid(), 'operativo'::app_role)
  )
);

-- 3. RESTRICT OPERATIVO ACCESS TO EMPLOYEE CONTACT INFO
-- Create a view that excludes sensitive contact information for operativo role
-- First, update the RLS policy for employees to only allow admin full access

-- Drop the current policy that gives operativo full access
DROP POLICY IF EXISTS "Admins and operativos can view employees" ON employees;

-- Create separate policies: admin gets full access, operativo gets limited access
CREATE POLICY "Admins can view all employees"
ON employees FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'administrador'::app_role)
);

-- Operativo can only see basic employee info (implemented via the view below)
-- For now, we keep operativo access but document this requires app-level filtering

-- Create a secure view for operativo users that excludes PII
CREATE OR REPLACE VIEW public.employees_limited AS
SELECT 
  id,
  nombre,
  cargo,
  created_at
FROM public.employees;

-- Grant access to the view
GRANT SELECT ON public.employees_limited TO authenticated;

-- Create a function to get employees based on role
CREATE OR REPLACE FUNCTION public.get_employees_for_role()
RETURNS TABLE (
  id uuid,
  nombre text,
  cargo text,
  telefono text,
  correo text,
  created_at timestamptz
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF public.has_role(auth.uid(), 'administrador'::app_role) THEN
    -- Admin gets full access
    RETURN QUERY SELECT e.id, e.nombre, e.cargo, e.telefono, e.correo, e.created_at 
    FROM employees e;
  ELSIF public.has_role(auth.uid(), 'operativo'::app_role) THEN
    -- Operativo gets limited access (no contact info)
    RETURN QUERY SELECT e.id, e.nombre, e.cargo, ''::text as telefono, ''::text as correo, e.created_at 
    FROM employees e;
  ELSE
    -- No access for other roles
    RETURN;
  END IF;
END;
$$;