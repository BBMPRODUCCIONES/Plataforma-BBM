-- Add RLS policy for operativo role to view horarios
CREATE POLICY "Operativos can view all horarios" 
ON public.horarios 
FOR SELECT 
USING (has_role(auth.uid(), 'operativo'::app_role));

-- Add RLS policy for operativo role to insert horarios
CREATE POLICY "Operativos can insert horarios" 
ON public.horarios 
FOR INSERT 
WITH CHECK (has_role(auth.uid(), 'operativo'::app_role));

-- Add RLS policy for operativo role to update horarios
CREATE POLICY "Operativos can update horarios" 
ON public.horarios 
FOR UPDATE 
USING (has_role(auth.uid(), 'operativo'::app_role));