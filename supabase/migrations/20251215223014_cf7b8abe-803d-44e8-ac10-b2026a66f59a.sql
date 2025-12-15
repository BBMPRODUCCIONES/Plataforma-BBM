-- Function to get the current user's linked employee (by email)
-- This bypasses the role-based filtering since it only returns YOUR OWN employee
CREATE OR REPLACE FUNCTION public.get_my_employee()
RETURNS TABLE(
  id uuid,
  nombre text,
  correo text,
  cargo text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_email text;
BEGIN
  -- Get the current user's email from auth
  SELECT email INTO user_email FROM auth.users WHERE auth.users.id = auth.uid();
  
  IF user_email IS NULL THEN
    RETURN;
  END IF;
  
  -- Return the employee linked to this email
  RETURN QUERY
  SELECT e.id, e.nombre, e.correo, e.cargo
  FROM employees e
  WHERE LOWER(e.correo) = LOWER(user_email)
    AND e.deleted_at IS NULL
  LIMIT 1;
END;
$$;