-- Drop and recreate function with new return type
DROP FUNCTION IF EXISTS public.get_employees_for_role();

CREATE OR REPLACE FUNCTION public.get_employees_for_role()
 RETURNS TABLE(id uuid, nombre text, cargo text, telefono text, correo text, banco text, tipo_cuenta text, numero_cuenta text, created_at timestamp with time zone)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF public.has_role(auth.uid(), 'administrador'::app_role) THEN
    RETURN QUERY SELECT e.id, e.nombre, e.cargo, e.telefono, e.correo, e.banco, e.tipo_cuenta, e.numero_cuenta, e.created_at 
    FROM employees e;
  ELSIF public.has_role(auth.uid(), 'operativo'::app_role) THEN
    RETURN QUERY SELECT e.id, e.nombre, e.cargo, ''::text as telefono, ''::text as correo, ''::text as banco, ''::text as tipo_cuenta, ''::text as numero_cuenta, e.created_at 
    FROM employees e;
  ELSE
    RETURN;
  END IF;
END;
$function$;