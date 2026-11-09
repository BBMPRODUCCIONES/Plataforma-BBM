-- Solo usuarios con rol (administrador u operativo) en la lista de Personal.
-- Salian dos cuentas viejas sin rol ("diana prueba 2" y Juan Gabriel Garcia,
-- de pruebas) que ya no son del equipo.
create or replace function public.usuarios_para_asignar()
returns table(id uuid, nombre text, correo text, empleado_id uuid, cargo text, cedula text)
language sql
stable
security definer
set search_path = public
as $$
  select p.id,
         trim(p.full_name) as nombre,
         r.email as correo,
         e.id as empleado_id,
         e.cargo,
         e.cedula
  from profiles p
  join lateral (
    select ur.email from user_roles ur where ur.user_id = p.id limit 1
  ) r on true
  left join lateral (
    select em.id, em.cargo, em.cedula
    from employees em
    where em.deleted_at is null
      and r.email is not null
      and lower(trim(em.correo)) = lower(trim(r.email))
    limit 1
  ) e on true
  where coalesce(trim(p.full_name), '') <> ''
    and (public.has_role(auth.uid(), 'administrador'::app_role)
         or public.has_role(auth.uid(), 'operativo'::app_role))
  order by trim(p.full_name);
$$;

