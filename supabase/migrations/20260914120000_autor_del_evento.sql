-- Guarda quien creo cada evento, para poder pintarlo por autor.
-- El valor lo pone el servidor a partir del token de sesion: el cliente
-- no puede falsearlo ni cambiarlo despues.

ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS created_by_email TEXT;

COMMENT ON COLUMN public.projects.created_by_email IS
  'Correo de quien creo el evento. Lo asigna el servidor en el INSERT y no se puede modificar.';

-- Al crear: se sella el autor con la sesion que hace el INSERT.
CREATE OR REPLACE FUNCTION public.set_project_creator()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  correo TEXT;
BEGIN
  correo := lower(trim(coalesce(auth.jwt() ->> 'email', '')));
  NEW.created_by := auth.uid();
  NEW.created_by_email := nullif(correo, '');
  RETURN NEW;
END;
$$;

-- Al actualizar: el autor no cambia nunca.
CREATE OR REPLACE FUNCTION public.keep_project_creator()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.created_by := OLD.created_by;
  NEW.created_by_email := OLD.created_by_email;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_project_creator ON public.projects;
CREATE TRIGGER trg_set_project_creator
  BEFORE INSERT ON public.projects
  FOR EACH ROW EXECUTE FUNCTION public.set_project_creator();

DROP TRIGGER IF EXISTS trg_keep_project_creator ON public.projects;
CREATE TRIGGER trg_keep_project_creator
  BEFORE UPDATE ON public.projects
  FOR EACH ROW EXECUTE FUNCTION public.keep_project_creator();

-- Los eventos que ya existian quedan sin autor (y por lo tanto sin color).
