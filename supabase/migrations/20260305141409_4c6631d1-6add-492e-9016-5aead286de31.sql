
-- Reset gastos_menores a Pendiente
UPDATE public.gastos_menores
SET estado = 'Pendiente',
    aprobado_por_id = NULL,
    aprobado_por_nombre = '',
    restaurada = NULL,
    restaurada_en = NULL,
    restaurada_por = NULL;

-- Reset caja_menor items en projects
UPDATE public.projects
SET caja_menor = (
  SELECT jsonb_agg(
    item || jsonb_build_object(
      'estado', 'Pendiente',
      'revisadoPor', '',
      'revisadoPorId', ''
    )
  )
  FROM jsonb_array_elements(caja_menor::jsonb) AS item
)
WHERE caja_menor IS NOT NULL
  AND caja_menor::text != '[]'
  AND caja_menor::text != 'null';

-- Reset legalizacion items en projects
UPDATE public.projects
SET legalizacion = (
  SELECT jsonb_agg(
    item || jsonb_build_object(
      'estado', 'Revisando',
      'revisadoPor', '',
      'revisadoPorId', ''
    )
  )
  FROM jsonb_array_elements(legalizacion::jsonb) AS item
)
WHERE legalizacion IS NOT NULL
  AND legalizacion::text != '[]'
  AND legalizacion::text != 'null';

-- Limpiar undo log
DELETE FROM public.aprobacion_undo_log;
