-- Aviso de "costos cerrados".
--
-- Cuando alguien cierra los costos de un evento (costos_verificados_en pasa
-- de vacio a una fecha), se le deja una notificacion en la app a todo el
-- equipo (todos los usuarios con rol), menos a quien cerro. La app la muestra en la barra superior (AvisoCostosCerrados).
-- No dispara notificaciones push: solo inserta en `notifications`.
create or replace function public.avisar_costos_cerrados()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_quien_email text := lower(coalesce(new.costos_verificados_por, auth.jwt() ->> 'email', ''));
  v_quien text;
  v_fecha text;
begin
  if old.costos_verificados_en is not null or new.costos_verificados_en is null then
    return new;
  end if;

  if v_quien_email = 'auxbbm@gmail.com' then
    v_quien := 'AUX BBM';
  else
    select coalesce(nullif(trim(p.full_name), ''), v_quien_email) into v_quien
    from user_roles r join profiles p on p.id = r.user_id
    where lower(r.email) = v_quien_email
    limit 1;
    v_quien := coalesce(v_quien, nullif(v_quien_email, ''), 'Alguien');
  end if;

  v_fecha := to_char(new.fecha_ejecucion_inicio::date, 'DD/MM/YYYY');

  insert into notifications (user_id, title, message, type, data)
  select r.user_id,
         'Costos cerrados por ' || v_quien,
         v_quien || ' cerró los costos de «' || coalesce(new.evento, 'evento') || '»'
           || coalesce(' (' || nullif(new.cliente, '') || ', ' || v_fecha || ')', '')
           || '. Ya nadie puede cargar ni cambiar costos en ese evento.',
         'info',
         jsonb_build_object(
           'tipo', 'costos_cerrados',
           'project_id', new.id,
           'evento', new.evento,
           'cerrado_por', v_quien_email
         )
  from user_roles r
  where lower(coalesce(r.email, '')) <> v_quien_email;

  return new;
end;
$$;

drop trigger if exists trg_avisar_costos_cerrados on public.projects;
create trigger trg_avisar_costos_cerrados
  after update of costos_verificados_en on public.projects
  for each row execute function public.avisar_costos_cerrados();
