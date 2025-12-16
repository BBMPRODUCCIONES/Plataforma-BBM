-- Drop and recreate get_employees_for_role function with cedula
DROP FUNCTION IF EXISTS public.get_employees_for_role();

CREATE FUNCTION public.get_employees_for_role()
 RETURNS TABLE(id uuid, nombre text, cargo text, telefono text, correo text, banco text, tipo_cuenta text, numero_cuenta text, cedula text, created_at timestamp with time zone)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF public.has_role(auth.uid(), 'administrador'::app_role) THEN
    RETURN QUERY SELECT e.id, e.nombre, e.cargo, e.telefono, e.correo, e.banco, e.tipo_cuenta, e.numero_cuenta, e.cedula, e.created_at 
    FROM employees e
    WHERE e.deleted_at IS NULL;
  ELSIF public.has_role(auth.uid(), 'operativo'::app_role) THEN
    RETURN QUERY SELECT e.id, e.nombre, e.cargo, ''::text as telefono, ''::text as correo, ''::text as banco, ''::text as tipo_cuenta, ''::text as numero_cuenta, e.cedula, e.created_at 
    FROM employees e
    WHERE e.deleted_at IS NULL;
  ELSE
    RETURN;
  END IF;
END;
$function$;