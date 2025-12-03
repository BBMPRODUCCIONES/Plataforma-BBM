-- Fix critical security issues in invitations table

-- 1. Drop the problematic "Anyone can view invitation by token" policy that exposes all invitation data
DROP POLICY IF EXISTS "Anyone can view invitation by token" ON public.invitations;

-- 2. Drop the overly permissive UPDATE policy
DROP POLICY IF EXISTS "Service role can update invitations" ON public.invitations;

-- 3. Restrict employee data access - only admins can see full employee information
DROP POLICY IF EXISTS "Authenticated users can view all employees" ON public.employees;

-- Create a more restrictive policy for employees
-- Admins can see all employees
CREATE POLICY "Admins can view all employees" 
ON public.employees 
FOR SELECT 
USING (has_role(auth.uid(), 'administrador'::app_role));

-- Operativos can see employees (needed for personnel assignment)
CREATE POLICY "Operativos can view employees" 
ON public.employees 
FOR SELECT 
USING (has_role(auth.uid(), 'operativo'::app_role));