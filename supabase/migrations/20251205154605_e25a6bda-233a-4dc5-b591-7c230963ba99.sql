-- Fix: Remove SECURITY DEFINER view (security concern)
-- The function get_employees_for_role() handles role-based access correctly
DROP VIEW IF EXISTS public.employees_limited;