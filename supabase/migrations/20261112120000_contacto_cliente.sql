-- Contacto del cliente en cada evento (lo llena el comercial).
ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS contacto_nombre text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS contacto_telefono text NOT NULL DEFAULT '';
