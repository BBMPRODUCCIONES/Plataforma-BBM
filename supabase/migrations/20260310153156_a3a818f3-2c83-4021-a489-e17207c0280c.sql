ALTER TABLE public.user_roles ADD COLUMN IF NOT EXISTS puede_editar_personal boolean DEFAULT false;
ALTER TABLE public.user_roles ADD COLUMN IF NOT EXISTS puede_editar_inventario boolean DEFAULT false;
ALTER TABLE public.user_roles ADD COLUMN IF NOT EXISTS puede_asignar_responsables boolean DEFAULT false;