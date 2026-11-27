-- Llegada y salida con foto, hora y ubicacion.
--
-- Cada usuario marca su propia llegada y su salida desde el planner. La hora
-- que vale es la del servidor (marcada_en se fuerza a now()), no la del
-- celular. La foto lleva estampada abajo la hora, las coordenadas y la
-- direccion. Los administradores ven todas las marcas para el reporte de
-- horas; cada quien ve las suyas.

create table if not exists public.marcaciones (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  nombre text not null default '',
  correo text not null default '',
  tipo text not null check (tipo in ('entrada', 'salida')),
  marcada_en timestamptz not null default now(),
  lat double precision,
  lng double precision,
  precision_m double precision,
  direccion text not null default '',
  foto_path text not null,
  created_at timestamptz not null default now()
);

create index if not exists marcaciones_user_fecha on public.marcaciones (user_id, marcada_en desc);
create index if not exists marcaciones_fecha on public.marcaciones (marcada_en desc);

alter table public.marcaciones enable row level security;

drop policy if exists "marcaciones: ver las mias o admin" on public.marcaciones;
create policy "marcaciones: ver las mias o admin" on public.marcaciones
  for select to authenticated
  using (user_id = auth.uid() or public.has_role(auth.uid(), 'administrador'::app_role));

drop policy if exists "marcaciones: marcar la mia" on public.marcaciones;
create policy "marcaciones: marcar la mia" on public.marcaciones
  for insert to authenticated
  with check (user_id = auth.uid());

drop policy if exists "marcaciones: admin borra" on public.marcaciones;
create policy "marcaciones: admin borra" on public.marcaciones
  for delete to authenticated
  using (public.has_role(auth.uid(), 'administrador'::app_role));

-- La hora y el dueno los pone el servidor.
create or replace function public.sellar_marcacion()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.user_id := auth.uid();
  new.marcada_en := now();
  new.created_at := now();
  new.correo := coalesce((select email from auth.users where id = auth.uid()), '');
  return new;
end;
$$;

drop trigger if exists sellar_marcacion on public.marcaciones;
create trigger sellar_marcacion before insert on public.marcaciones
  for each row execute function public.sellar_marcacion();

-- Fotos: bucket privado. Cada quien sube a su carpeta (<user_id>/...);
-- lee las suyas, y el administrador lee todas.
insert into storage.buckets (id, name, public)
values ('marcaciones', 'marcaciones', false)
on conflict (id) do nothing;

drop policy if exists "marcaciones fotos: subir la mia" on storage.objects;
create policy "marcaciones fotos: subir la mia" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'marcaciones' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "marcaciones fotos: ver" on storage.objects;
create policy "marcaciones fotos: ver" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'marcaciones'
    and ((storage.foldername(name))[1] = auth.uid()::text
         or public.has_role(auth.uid(), 'administrador'::app_role))
  );
