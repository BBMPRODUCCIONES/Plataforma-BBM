-- Drop existing restrictive policies and recreate as permissive

-- CLIENTS TABLE
DROP POLICY IF EXISTS "Authenticated users can view all clients" ON public.clients;
DROP POLICY IF EXISTS "Admins can insert clients" ON public.clients;
DROP POLICY IF EXISTS "Admins can update clients" ON public.clients;
DROP POLICY IF EXISTS "Admins can delete clients" ON public.clients;

CREATE POLICY "Authenticated users can view all clients" 
ON public.clients FOR SELECT 
TO authenticated
USING (true);

CREATE POLICY "Admins can insert clients" 
ON public.clients FOR INSERT 
TO authenticated
WITH CHECK (has_role(auth.uid(), 'administrador'::app_role));

CREATE POLICY "Admins can update clients" 
ON public.clients FOR UPDATE 
TO authenticated
USING (has_role(auth.uid(), 'administrador'::app_role));

CREATE POLICY "Admins can delete clients" 
ON public.clients FOR DELETE 
TO authenticated
USING (has_role(auth.uid(), 'administrador'::app_role));

-- EMPLOYEES TABLE
DROP POLICY IF EXISTS "Admins can view all employees" ON public.employees;
DROP POLICY IF EXISTS "Operativos can view employees" ON public.employees;
DROP POLICY IF EXISTS "Admins can insert employees" ON public.employees;
DROP POLICY IF EXISTS "Admins can update employees" ON public.employees;
DROP POLICY IF EXISTS "Admins can delete employees" ON public.employees;

CREATE POLICY "Authenticated users can view employees" 
ON public.employees FOR SELECT 
TO authenticated
USING (true);

CREATE POLICY "Admins can insert employees" 
ON public.employees FOR INSERT 
TO authenticated
WITH CHECK (has_role(auth.uid(), 'administrador'::app_role));

CREATE POLICY "Admins can update employees" 
ON public.employees FOR UPDATE 
TO authenticated
USING (has_role(auth.uid(), 'administrador'::app_role));

CREATE POLICY "Admins can delete employees" 
ON public.employees FOR DELETE 
TO authenticated
USING (has_role(auth.uid(), 'administrador'::app_role));

-- PROJECTS TABLE
DROP POLICY IF EXISTS "Authenticated users can view all projects" ON public.projects;
DROP POLICY IF EXISTS "Admins can insert projects" ON public.projects;
DROP POLICY IF EXISTS "Admins and operativos can update projects" ON public.projects;
DROP POLICY IF EXISTS "Admins can delete projects" ON public.projects;

CREATE POLICY "Authenticated users can view all projects" 
ON public.projects FOR SELECT 
TO authenticated
USING (true);

CREATE POLICY "Admins can insert projects" 
ON public.projects FOR INSERT 
TO authenticated
WITH CHECK (has_role(auth.uid(), 'administrador'::app_role));

CREATE POLICY "Admins and operativos can update projects" 
ON public.projects FOR UPDATE 
TO authenticated
USING (has_role(auth.uid(), 'administrador'::app_role) OR has_role(auth.uid(), 'operativo'::app_role));

CREATE POLICY "Admins can delete projects" 
ON public.projects FOR DELETE 
TO authenticated
USING (has_role(auth.uid(), 'administrador'::app_role));