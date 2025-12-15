-- Add soft delete columns to employees table
ALTER TABLE public.employees ADD COLUMN deleted_at TIMESTAMPTZ DEFAULT NULL;
ALTER TABLE public.employees ADD COLUMN deleted_by UUID DEFAULT NULL;

-- Update the get_employees_for_role function to exclude soft-deleted employees
CREATE OR REPLACE FUNCTION public.get_employees_for_role()
 RETURNS TABLE(id uuid, nombre text, cargo text, telefono text, correo text, banco text, tipo_cuenta text, numero_cuenta text, created_at timestamp with time zone)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF public.has_role(auth.uid(), 'administrador'::app_role) THEN
    RETURN QUERY SELECT e.id, e.nombre, e.cargo, e.telefono, e.correo, e.banco, e.tipo_cuenta, e.numero_cuenta, e.created_at 
    FROM employees e
    WHERE e.deleted_at IS NULL;
  ELSIF public.has_role(auth.uid(), 'operativo'::app_role) THEN
    RETURN QUERY SELECT e.id, e.nombre, e.cargo, ''::text as telefono, ''::text as correo, ''::text as banco, ''::text as tipo_cuenta, ''::text as numero_cuenta, e.created_at 
    FROM employees e
    WHERE e.deleted_at IS NULL;
  ELSE
    RETURN;
  END IF;
END;
$function$;

-- Create function to get employee name even if deleted (for historical records)
CREATE OR REPLACE FUNCTION public.get_employee_name_by_id(_employee_id uuid)
RETURNS text
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT nombre FROM employees WHERE id = _employee_id
$function$;