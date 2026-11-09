-- Personal que todavia no tiene cuenta en el planner.
--
-- La lista de "Personal" (y de productor) sale de los usuarios con rol. Hay
-- gente del equipo que aun no tiene correo/cuenta y que los productores
-- necesitan asignar a eventos. Se marcan en su ficha de empleado con
-- asignable_sin_cuenta = true y salen en la lista mientras no exista un
-- usuario con su mismo correo (cuando lo tengan, sale el usuario y no se
-- duplica).
alter table public.employees
  add column if not exists asignable_sin_cuenta boolean not null default false;

create or replace function public.usuarios_para_asignar()
returns table(id uuid, nombre text, correo text, empleado_id uuid, cargo text, cedula text)
language sql
stable
security definer
set search_path = public
as $$
  select * from (
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

    union all

    select em.id,
           trim(em.nombre),
           nullif(trim(em.correo), ''),
           em.id,
           em.cargo,
           em.cedula
    from employees em
    where em.asignable_sin_cuenta
      and em.deleted_at is null
      and coalesce(trim(em.nombre), '') <> ''
      and not exists (
        select 1 from user_roles ur
        where trim(em.correo) <> '' and lower(trim(ur.email)) = lower(trim(em.correo))
      )
  ) t
  where public.has_role(auth.uid(), 'administrador'::app_role)
     or public.has_role(auth.uid(), 'operativo'::app_role)
  order by nombre;
$$;

-- Los dos primeros: Camilo Ospina (ya tenia ficha) y Salustiano Benavides.
update public.employees
   set nombre = 'Camilo Ospina', asignable_sin_cuenta = true
 where id = '79248671-9d4e-4133-b6a0-6826215f510c';

insert into public.employees (nombre, cargo, telefono, correo, banco, tipo_cuenta, numero_cuenta, cedula, asignable_sin_cuenta)
select 'Salustiano Benavides', 'Operativo', '', '', '', '', '', '', true
where not exists (select 1 from public.employees where nombre ilike 'salustiano benavides%' and deleted_at is null);
