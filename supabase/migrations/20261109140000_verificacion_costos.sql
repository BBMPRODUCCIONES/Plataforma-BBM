-- Check de "costos verificados" (lo da auxbbm@).
--
-- La huella la calcula la app sobre los costos que verifico: si los costos
-- cambian despues, la app ve que la huella no coincide y los vuelve a pedir.
ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS costos_verificados_por text,
  ADD COLUMN IF NOT EXISTS costos_verificados_en timestamptz,
  ADD COLUMN IF NOT EXISTS costos_verificados_huella text;

-- Misma lista que src/lib/permisosCostos.ts.
create or replace function public.puede_verificar_costos(p_email text)
returns boolean
language sql
immutable
set search_path = public
as $$
  select lower(trim(coalesce(p_email, ''))) = any (array[
    'auxbbm@gmail.com',
    'bayron.bocanegra@bbmproducciones.com.co'
  ]);
$$;

-- Fuera de la lista, la verificacion queda como estaba (sin error, para no
-- tumbar el resto del guardado).
create or replace function public.proteger_verificacion_costos()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if auth.uid() is null or coalesce(auth.jwt() ->> 'role', '') = 'service_role' then
    return new;
  end if;
  if public.puede_verificar_costos(auth.jwt() ->> 'email') then
    return new;
  end if;
  if tg_op = 'INSERT' then
    new.costos_verificados_por := null;
    new.costos_verificados_en := null;
    new.costos_verificados_huella := null;
  else
    new.costos_verificados_por := old.costos_verificados_por;
    new.costos_verificados_en := old.costos_verificados_en;
    new.costos_verificados_huella := old.costos_verificados_huella;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_proteger_verificacion_costos on public.projects;
create trigger trg_proteger_verificacion_costos
  before insert or update on public.projects
  for each row execute function public.proteger_verificacion_costos();
