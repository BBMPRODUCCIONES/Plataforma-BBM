-- Permitir borrar usuarios sin perder el historial.
--
-- Cuatro tablas apuntan a auth.users sin decir que hacer al borrar. Postgres
-- asume NO ACTION: si la persona dejo aunque sea una invitacion, una
-- cotizacion, una configuracion de columnas o un evento, el borrado se
-- rechaza y la funcion responde con un error generico.
--
-- Se pasan a ON DELETE SET NULL: el registro historico se conserva y el
-- vinculo con el usuario queda en nulo. Las columnas *_email que acompanan a
-- cada una siguen diciendo quien fue, asi que no se pierde la trazabilidad.
--
-- profiles y user_roles ya estaban en CASCADE y no se tocan: esos si deben
-- desaparecer con la persona.

ALTER TABLE public.invitations
  DROP CONSTRAINT IF EXISTS invitations_created_by_admin_id_fkey,
  ADD CONSTRAINT invitations_created_by_admin_id_fkey
    FOREIGN KEY (created_by_admin_id) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.supplier_cotizacion_history
  DROP CONSTRAINT IF EXISTS supplier_cotizacion_history_uploaded_by_fkey,
  ADD CONSTRAINT supplier_cotizacion_history_uploaded_by_fkey
    FOREIGN KEY (uploaded_by) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.panel_column_configs
  DROP CONSTRAINT IF EXISTS panel_column_configs_updated_by_fkey,
  ADD CONSTRAINT panel_column_configs_updated_by_fkey
    FOREIGN KEY (updated_by) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.projects
  DROP CONSTRAINT IF EXISTS projects_created_by_fkey,
  ADD CONSTRAINT projects_created_by_fkey
    FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;
