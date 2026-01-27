-- Drop the existing INSERT policy that only allows admins
DROP POLICY IF EXISTS "Admins can insert suppliers" ON public.suppliers;

-- Create new INSERT policy that allows both admins and operativos to insert suppliers
CREATE POLICY "Admins and operativos can insert suppliers"
ON public.suppliers
FOR INSERT
WITH CHECK (
  has_role(auth.uid(), 'administrador'::app_role) OR
  has_role(auth.uid(), 'operativo'::app_role)
);