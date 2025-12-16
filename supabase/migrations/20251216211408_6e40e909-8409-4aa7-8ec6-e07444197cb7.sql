-- Add cedula field to employees (required by get_employees_for_role and Personal template)
ALTER TABLE public.employees
ADD COLUMN IF NOT EXISTS cedula text NOT NULL DEFAULT ''::text;