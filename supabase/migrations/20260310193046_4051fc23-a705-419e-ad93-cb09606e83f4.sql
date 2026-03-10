
ALTER TABLE public.user_roles
  ADD COLUMN puede_acceder_usuarios boolean DEFAULT true,
  ADD COLUMN puede_acceder_clientes boolean DEFAULT true,
  ADD COLUMN puede_acceder_empleados boolean DEFAULT true,
  ADD COLUMN puede_acceder_constructor boolean DEFAULT true,
  ADD COLUMN puede_acceder_agentes boolean DEFAULT true;
