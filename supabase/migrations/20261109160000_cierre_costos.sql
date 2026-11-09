-- Cierre de costos.
--
-- Cuando auxbbm@ completa el checklist (todas las lineas verificadas) la app
-- marca costos_verificados_por / costos_verificados_en: los costos quedan
-- CERRADOS. Desde ahi, quien no puede verificar no puede agregar, cambiar ni
-- borrar costos ni sus soportes: la base deja `costos` y `costos_adjuntos`
-- como estaban. Reabrir es borrar esa marca, y solo lo puede hacer quien
-- verifica (las columnas ya estan protegidas en este mismo trigger).
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

    -- Costos cerrados: no se tocan.
    if old.costos_verificados_en is not null then
      new.costos := old.costos;
      new.costos_adjuntos := old.costos_adjuntos;
      return new;
    end if;
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
