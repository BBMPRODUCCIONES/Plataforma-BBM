ALTER TABLE public.user_roles 
  ADD COLUMN puede_editar_general boolean DEFAULT false,
  ADD COLUMN puede_editar_operaciones boolean DEFAULT false;