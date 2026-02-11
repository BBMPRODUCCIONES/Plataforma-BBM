
-- Add sequential number column for Solicitud de Anticipo
ALTER TABLE public.projects ADD COLUMN solicitud_anticipo_num integer;

-- Create function to assign sequential number atomically
CREATE OR REPLACE FUNCTION public.assign_solicitud_anticipo_num(p_project_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  existing_num integer;
  next_num integer;
BEGIN
  -- Check if already assigned (with row lock)
  SELECT solicitud_anticipo_num INTO existing_num
  FROM projects
  WHERE id = p_project_id
  FOR UPDATE;

  IF existing_num IS NOT NULL THEN
    RETURN existing_num;
  END IF;

  -- Calculate next number
  SELECT COALESCE(MAX(solicitud_anticipo_num), 0) + 1 INTO next_num
  FROM projects;

  -- Assign it
  UPDATE projects
  SET solicitud_anticipo_num = next_num
  WHERE id = p_project_id;

  RETURN next_num;
END;
$$;
