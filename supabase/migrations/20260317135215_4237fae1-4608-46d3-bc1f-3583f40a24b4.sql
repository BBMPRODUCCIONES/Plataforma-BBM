ALTER TABLE public.user_roles ADD COLUMN IF NOT EXISTS puede_desembolsar boolean DEFAULT false;
ALTER TABLE public.user_roles ADD COLUMN IF NOT EXISTS puede_acceder_aprobaciones boolean DEFAULT false;