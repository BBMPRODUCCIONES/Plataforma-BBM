-- Informe de ventas: agrega el numero de cotizacion.
--
-- No hay un campo para el numero: sale del nombre de los PDF de cotizacion
-- ("Cotizacion-C-1-1451-...", "No. C-1-1401 ...", "Cotizacion-N-2-0022-...")
-- o de las notas ("Cotizacion N 2-0106"). La funcion devuelve los nombres de
-- archivo y las notas; el numero se extrae en el navegador.

create or replace function public.informe_ventas(p_desde date, p_hasta date)
returns setof jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.puede_exportar_costos(auth.jwt() ->> 'email') then
    raise exception 'No tienes permiso para sacar el informe de ventas' using errcode = '42501';
  end if;
  return query
    select jsonb_build_object(
      'id', p.id,
      'evento', p.evento,
      'cliente', p.cliente,
      'productor', p.productor,
      'estado', p.estado,
      'fecha_ejecucion_inicio', p.fecha_ejecucion_inicio,
      'fecha_ejecucion_fin', p.fecha_ejecucion_fin,
      'ingreso_bruto', p.ingreso_bruto,
      'ingreso_total', p.ingreso_total,
      'color', p.color,
      'created_by_email', p.created_by_email,
      'num_factura', p.num_factura,
      'estado_facturacion', p.estado_facturacion,
      'factura_fecha', p.factura_fecha,
      'factura_subtotal', p.factura_subtotal,
      'factura_iva', p.factura_iva,
      'factura_total', p.factura_total,
      'factura_archivo', p.factura_archivo,
      'notas', p.notas,
      'cotizaciones', (
        select coalesce(jsonb_agg(e ->> 'name'), '[]'::jsonb)
        from jsonb_array_elements(case when jsonb_typeof(p.cotizaciones) = 'array' then p.cotizaciones else '[]'::jsonb end) e
      )
    )
    from projects p
    where coalesce(p.is_deleted, false) = false
      and (
        p.fecha_ejecucion_inicio::date between p_desde and p_hasta
        or p.factura_fecha between p_desde and p_hasta
      )
    order by p.fecha_ejecucion_inicio, p.evento;
end;
$$;

revoke all on function public.informe_ventas(date, date) from public, anon;
grant execute on function public.informe_ventas(date, date) to authenticated;
