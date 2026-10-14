-- ============================================================
-- BODEGA · observaciones generales: lo que no es de un equipo
-- ============================================================
-- Las novedades siempre cuelgan de un equipo del inventario. Pero media
-- bodega no cabe ahi: "hay que comprar 20 cables XLR" no se puede anotar
-- sobre un equipo, porque el equipo todavia no existe. Hasta ahora eso vivia
-- en un cuaderno o en un chat, que es donde se pierde.
--
-- Se reusa novedades_bodega en vez de crear tabla nueva. Comparten todo lo
-- que importa: quien las ve, el bucket de fotos, la fecha del hecho y el
-- cerrarlas con nota en vez de borrarlas. Lo unico que cambia es que estas
-- no apuntan a ningun activo.
-- ============================================================


-- ------------------------------------------------------------
-- 1 · Una novedad puede no tener equipo
-- ------------------------------------------------------------
ALTER TABLE public.novedades_bodega
  ALTER COLUMN activo_id DROP NOT NULL;

-- Los cuatro tipos nuevos son los generales. Los cuatro viejos siguen igual.
ALTER TABLE public.novedades_bodega
  DROP CONSTRAINT IF EXISTS novedades_bodega_tipo_check;

ALTER TABLE public.novedades_bodega
  ADD CONSTRAINT novedades_bodega_tipo_check CHECK (tipo IN (
    --  de un equipo del inventario
    'dano','observacion','mantenimiento','baja',
    --  de la bodega en general
    --    compra   hace falta y hay que conseguirlo
    --    general  cualquier anotacion que no sea de un equipo puntual
    --    reparar  algo que hay que mandar a arreglar afuera
    --    mejora   ideas de organizacion, estanteria, marcacion
    'compra','general','reparar','mejora'
  ));

-- Que cada tipo viva donde debe. Sin esto las dos listas se ensucian solas:
-- un "dano" sin equipo no se puede rastrear, y un "por comprar" colgado de un
-- activo haria creer que ese activo tiene algo pendiente.
ALTER TABLE public.novedades_bodega
  DROP CONSTRAINT IF EXISTS novedades_tipo_concuerda_con_activo;

ALTER TABLE public.novedades_bodega
  ADD CONSTRAINT novedades_tipo_concuerda_con_activo CHECK (
    (tipo IN ('dano','observacion','mantenimiento','baja') AND activo_id IS NOT NULL)
    OR
    (tipo IN ('compra','general','reparar','mejora')       AND activo_id IS NULL)
  );


-- ------------------------------------------------------------
-- 2 · Cuanto costaria
-- ------------------------------------------------------------
-- Estimado, no precio pagado: sirve para saber cuanto pesa la lista de
-- compras antes de cotizar. numeric y no float, que esto se suma.
ALTER TABLE public.novedades_bodega
  ADD COLUMN IF NOT EXISTS valor_estimado numeric(14,2);

ALTER TABLE public.novedades_bodega
  DROP CONSTRAINT IF EXISTS novedades_valor_estimado_check;

ALTER TABLE public.novedades_bodega
  ADD CONSTRAINT novedades_valor_estimado_check
  CHECK (valor_estimado IS NULL OR valor_estimado >= 0);

COMMENT ON COLUMN public.novedades_bodega.valor_estimado IS
  'Valor unitario estimado en pesos. Solo lo ven los correos de puede_ver_valores_bodega().';

-- El tablero de lo general: lo abierto, lo mas reciente primero.
CREATE INDEX IF NOT EXISTS novedades_generales
  ON public.novedades_bodega (fecha DESC)
  WHERE activo_id IS NULL AND NOT resuelta;


-- ------------------------------------------------------------
-- 3 · El valor estimado se enmascara, igual que los precios
-- ------------------------------------------------------------
-- Misma regla que el resto de la plata de bodega: sale en NULL desde el
-- servidor para quien no debe verlo, no escondido en la pantalla. La vista
-- se lee en lugar de la tabla; las escrituras siguen yendo a la tabla.
DROP VIEW IF EXISTS public.novedades_bodega_vista;

CREATE VIEW public.novedades_bodega_vista AS
SELECT
  n.id,
  n.activo_id,
  n.tipo,
  n.descripcion,
  n.fecha,
  n.unidades,
  CASE WHEN public.puede_ver_valores_bodega() THEN n.valor_estimado END AS valor_estimado,
  n.project_id,
  n.evento_nombre,
  n.fotos,
  n.resuelta,
  n.resuelta_en,
  n.resuelta_nota,
  n.resuelta_por_nombre,
  n.reportada_por,
  n.reportada_por_nombre,
  n.created_at
FROM public.novedades_bodega n;

COMMENT ON VIEW public.novedades_bodega_vista IS
  'Las novedades con el valor estimado en NULL salvo para quien puede ver cifras de bodega.';

-- Corre con los permisos de quien pregunta: la politica de SELECT de la
-- tabla sigue aplicando a traves de la vista.
ALTER VIEW public.novedades_bodega_vista SET (security_invoker = on);

GRANT SELECT ON public.novedades_bodega_vista TO authenticated;


-- ------------------------------------------------------------
-- 4 · Quien no ve el valor tampoco lo pisa
-- ------------------------------------------------------------
-- Cerrar una novedad es un UPDATE que manda la fila entera. Sin esto, quien
-- recibio NULL en valor_estimado lo devolveria en NULL y borraria el dato al
-- marcar una compra como hecha.
CREATE OR REPLACE FUNCTION public.protege_valor_novedad()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.puede_ver_valores_bodega() THEN
    NEW.valor_estimado := OLD.valor_estimado;
  END IF;
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.protege_valor_novedad() IS
  'Si quien edita no ve el valor estimado, el valor estimado no cambia.';

DROP TRIGGER IF EXISTS trg_novedades_protege_valor ON public.novedades_bodega;
CREATE TRIGGER trg_novedades_protege_valor
  BEFORE UPDATE ON public.novedades_bodega
  FOR EACH ROW EXECUTE FUNCTION public.protege_valor_novedad();


-- ------------------------------------------------------------
-- Comprobacion
-- ------------------------------------------------------------
SELECT
  (SELECT count(*) FROM public.novedades_bodega WHERE activo_id IS NULL)      AS generales,
  (SELECT count(*) FROM public.novedades_bodega WHERE activo_id IS NOT NULL)  AS de_equipos,
  (SELECT count(*) FROM information_schema.columns
    WHERE table_schema='public' AND table_name='novedades_bodega_vista')      AS columnas_vista,
  (SELECT is_nullable FROM information_schema.columns
    WHERE table_schema='public' AND table_name='novedades_bodega'
      AND column_name='activo_id')                                            AS activo_opcional,
  public.puede_ver_valores_bodega()                                           AS ve_valores;
