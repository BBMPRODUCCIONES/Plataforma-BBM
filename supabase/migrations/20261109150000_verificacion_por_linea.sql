-- Verificacion de costos LINEA POR LINEA.
--
-- Cada linea de `costos` (jsonb) puede traer `verificacion` {por, en, huella}.
-- Solo auxbbm@ y Bayron (puede_verificar_costos) pueden ponerla o quitarla:
-- para los demas, cada linea conserva la verificacion que tenia en la base
-- (buscada por id), y las lineas nuevas entran sin verificacion. Si alguien
-- cambia el valor o el concepto, la huella deja de coincidir y la app la
-- muestra como "cambio despues de verificarse".
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

  if new.costos is not null and jsonb_typeof(new.costos) = 'array' then
    new.costos := (
      select coalesce(
        jsonb_agg(
          (x.e - 'verificacion')
          || case when o.v is not null then jsonb_build_object('verificacion', o.v) else '{}'::jsonb end
          order by x.ord
        ),
        '[]'::jsonb
      )
      from jsonb_array_elements(new.costos) with ordinality as x(e, ord)
      left join lateral (
        select oe -> 'verificacion' as v
        from jsonb_array_elements(
          case when tg_op = 'UPDATE' and jsonb_typeof(old.costos) = 'array' then old.costos else '[]'::jsonb end
        ) as oe
        where oe ->> 'id' = x.e ->> 'id'
          and jsonb_typeof(oe -> 'verificacion') = 'object'
        limit 1
      ) o on true
    );
  end if;
  return new;
end;
$$;
