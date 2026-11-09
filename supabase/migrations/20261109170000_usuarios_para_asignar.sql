-- Lista de personas para asignar a un evento (selector "Personal").
--
-- La app la armaba leyendo profiles y user_roles. Los operativos pueden leer
-- los nombres pero no user_roles, asi que les faltaban los correos y con eso
-- no se podia amarrar la persona con su ficha de empleado (cargo, cedula).
-- Esta funcion se lo da a cualquiera del equipo (administrador u operativo).
-- No devuelve telefono, banco ni cuenta: eso sigue siendo solo de admin.
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
  left join lateral (
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

revoke all on function public.usuarios_para_asignar() from public, anon;
grant execute on function public.usuarios_para_asignar() to authenticated;
