-- Exportar costos: solo estas seis personas pueden descargar la informacion
-- de costos (misma lista en src/lib/permisosCostos.ts).
create or replace function public.puede_exportar_costos(p_email text)
returns boolean
language sql
immutable
set search_path = public
as $$
  select lower(trim(coalesce(p_email, ''))) = any (array[
    'auxbbm@gmail.com',
    'abraham.varela@bbmproducciones.com.co',
    'gerencia.administrativa@bbmproducciones.com.co',
    'contabilidadbbm@gmail.com',
    'bayron.bocanegra@bbmproducciones.com.co',
    'administrativo@bbmproducciones.com.co'
  ]);
$$;

-- Eventos (no borrados) cuya ejecucion arranca entre p_desde y p_hasta, con
-- sus costos. La comprobacion del correo esta aqui, en la base: quien no esta
-- en la lista recibe un error aunque llame la funcion por fuera de la app.
create or replace function public.exportar_costos(p_desde date, p_hasta date)
returns setof jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.puede_exportar_costos(auth.jwt() ->> 'email') then
    raise exception 'No tienes permiso para exportar costos' using errcode = '42501';
  end if;
  return query
    select jsonb_build_object(
      'id', p.id,
      'evento', p.evento,
      'cliente', p.cliente,
      'centro_costos', p.centro_costos,
      'productor', p.productor,
      'estado', p.estado,
      'fecha_ejecucion_inicio', p.fecha_ejecucion_inicio,
      'fecha_ejecucion_fin', p.fecha_ejecucion_fin,
      'ingreso_bruto', p.ingreso_bruto,
      'ingreso_total', p.ingreso_total,
      'num_factura', p.num_factura,
      'estado_facturacion', p.estado_facturacion,
      'factura_fecha', p.factura_fecha,
      'factura_subtotal', p.factura_subtotal,
      'costos', coalesce(p.costos, '[]'::jsonb),
      'costos_cerrados_por', p.costos_verificados_por,
      'costos_cerrados_en', p.costos_verificados_en
    )
    from projects p
    where coalesce(p.is_deleted, false) = false
      and p.fecha_ejecucion_inicio::date between p_desde and p_hasta
    order by p.fecha_ejecucion_inicio, p.evento;
end;
$$;

revoke all on function public.exportar_costos(date, date) from public, anon;
grant execute on function public.exportar_costos(date, date) to authenticated;
