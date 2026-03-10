
ALTER TABLE public.user_roles ADD COLUMN IF NOT EXISTS puede_restaurar_solicitudes boolean DEFAULT false;
ALTER TABLE public.gastos_menores ADD COLUMN IF NOT EXISTS restaurada_razon text DEFAULT NULL;
