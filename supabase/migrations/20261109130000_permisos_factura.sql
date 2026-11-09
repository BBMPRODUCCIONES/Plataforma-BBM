-- Quien puede manejar la factura de un evento.
--
-- Solo estas personas pueden subir la factura, cambiar su numero o marcar
-- "No se factura". La misma lista esta en src/lib/permisosFactura.ts (que
-- solo esconde botones); esta es la que de verdad lo impide.
create or replace function public.puede_gestionar_factura(p_email text)
returns boolean
language sql
immutable
set search_path = public
as $$
  select lower(trim(coalesce(p_email, ''))) = any (array[
    'administrativo@bbmproducciones.com.co',
    'auxbbm@gmail.com',
    'abraham.varela@bbmproducciones.com.co',
    'gerencia.administrativa@bbmproducciones.com.co',
    'contabilidadbbm@gmail.com',
    'bayron.bocanegra@bbmproducciones.com.co'
  ]);
$$;

-- Si alguien fuera de la lista intenta cambiar la factura, esos campos se
-- dejan como estaban y el resto del cambio sigue. No se lanza error a
-- proposito: el panel guarda la fila completa, y un error aqui haria perder
-- tambien los costos u horarios que esa persona si podia cambiar.
-- El SQL del panel de Supabase, el cron y las funciones con service_role no
-- traen correo de usuario y pasan.
create or replace function public.proteger_factura()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_rol text := coalesce(auth.jwt() ->> 'role', '');
  v_email text := auth.jwt() ->> 'email';
begin
  if auth.uid() is null or v_rol = 'service_role' then
    return new;
  end if;
  if public.puede_gestionar_factura(v_email) then
    return new;
  end if;

  if tg_op = 'INSERT' then
    new.num_factura := '';
    new.factura_fecha := null;
    new.factura_subtotal := null;
    new.factura_iva := null;
    new.factura_total := null;
    new.factura_archivo := null;
    new.factura_registrada_por := null;
    new.factura_registrada_en := null;
    if new.estado_facturacion in ('facturado', 'no_se_factura') then
      new.estado_facturacion := 'sin_definir';
    end if;
    return new;
  end if;

  new.num_factura := old.num_factura;
  new.estado_facturacion := old.estado_facturacion;
  new.factura_fecha := old.factura_fecha;
  new.factura_subtotal := old.factura_subtotal;
  new.factura_iva := old.factura_iva;
  new.factura_total := old.factura_total;
  new.factura_archivo := old.factura_archivo;
  new.factura_registrada_por := old.factura_registrada_por;
  new.factura_registrada_en := old.factura_registrada_en;
  return new;
end;
$$;

drop trigger if exists trg_proteger_factura on public.projects;
create trigger trg_proteger_factura
  before insert or update on public.projects
  for each row execute function public.proteger_factura();
