-- Add unique constraint on employees email (correo column)
-- This ensures no duplicate emails in the employees table
ALTER TABLE public.employees 
ADD CONSTRAINT employees_correo_unique UNIQUE (correo);

-- Note: user_roles already has email column, let's add unique constraint there too
-- This prevents duplicate emails in user_roles
ALTER TABLE public.user_roles 
ADD CONSTRAINT user_roles_email_unique UNIQUE (email);