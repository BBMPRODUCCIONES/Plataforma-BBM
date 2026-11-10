-- Productividad del equipo (apartado solo de Bayron).
--
-- `tareas`: las tareas que Bayron asigna a mano. Cada persona ve y marca como
-- hechas solo las suyas; crear, editar y borrar es solo de Bayron.
-- `metas_ventas`: meta mensual de ventas (sin IVA) por comercial. Solo Bayron.
create or replace function public.es_dueno_productividad()
returns boolean
language sql
stable
set search_path = public
as $$
  select lower(coalesce(auth.jwt() ->> 'email', '')) = 'bayron.bocanegra@bbmproducciones.com.co';
$$;

create table if not exists public.tareas (
  id uuid primary key default gen_random_uuid(),
  titulo text not null check (length(trim(titulo)) > 0),
  descripcion text not null default '',
  asignada_a uuid,
  asignada_a_nombre text not null,
  asignada_a_correo text,
  fecha_limite date,
  estado text not null default 'pendiente' check (estado in ('pendiente', 'hecha')),
  project_id uuid references public.projects(id) on delete set null,
  creada_por text,
  creada_en timestamptz not null default now(),
  hecha_en timestamptz,
  hecha_por text
);
create index if not exists idx_tareas_asignada on public.tareas (asignada_a, estado);

alter table public.tareas enable row level security;

drop policy if exists "tareas: ver" on public.tareas;
create policy "tareas: ver" on public.tareas for select to authenticated
  using (public.es_dueno_productividad() or asignada_a = auth.uid());
drop policy if exists "tareas: crear" on public.tareas;
create policy "tareas: crear" on public.tareas for insert to authenticated
  with check (public.es_dueno_productividad());
drop policy if exists "tareas: actualizar" on public.tareas;
create policy "tareas: actualizar" on public.tareas for update to authenticated
  using (public.es_dueno_productividad() or asignada_a = auth.uid());
drop policy if exists "tareas: borrar" on public.tareas;
create policy "tareas: borrar" on public.tareas for delete to authenticated
  using (public.es_dueno_productividad());

-- Quien no es Bayron solo puede cambiar el estado de SU tarea; lo demas se
-- deja como estaba. La fecha y el autor de "hecha" los pone la base.
create or replace function public.proteger_tareas()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if not public.es_dueno_productividad() and auth.uid() is not null then
    new.titulo := old.titulo;
    new.descripcion := old.descripcion;
    new.asignada_a := old.asignada_a;
    new.asignada_a_nombre := old.asignada_a_nombre;
    new.asignada_a_correo := old.asignada_a_correo;
    new.fecha_limite := old.fecha_limite;
    new.project_id := old.project_id;
    new.creada_por := old.creada_por;
    new.creada_en := old.creada_en;
  end if;
  if new.estado = 'hecha' and old.estado <> 'hecha' then
    new.hecha_en := now();
    new.hecha_por := auth.jwt() ->> 'email';
  elsif new.estado = 'pendiente' then
    new.hecha_en := null;
    new.hecha_por := null;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_proteger_tareas on public.tareas;
create trigger trg_proteger_tareas before update on public.tareas
  for each row execute function public.proteger_tareas();

create table if not exists public.metas_ventas (
  comercial text primary key,
  meta_mensual numeric not null check (meta_mensual >= 0),
  actualizada_en timestamptz not null default now()
);
alter table public.metas_ventas enable row level security;
drop policy if exists "metas: solo dueno" on public.metas_ventas;
create policy "metas: solo dueno" on public.metas_ventas for all to authenticated
  using (public.es_dueno_productividad()) with check (public.es_dueno_productividad());

insert into public.metas_ventas (comercial, meta_mensual)
values ('Abraham', 100000000)
on conflict (comercial) do nothing;

do $$
begin
  alter publication supabase_realtime add table public.tareas;
exception when duplicate_object then null;
end $$;
