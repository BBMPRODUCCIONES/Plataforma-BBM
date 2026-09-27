-- ============================================================
-- BODEGA  ·  activos y movimientos
-- ============================================================
-- Hasta ahora el inventario vivia en un Excel y dentro de cada evento habia
-- una lista suelta de lo que salio. Eso responde "que se llevaron al evento"
-- pero no responde la pregunta que de verdad importa en bodega: "de los 12
-- pares LED que tenemos, cuantos estan libres para el sabado".
--
-- Dos tablas, y una sola fuente de verdad:
--
--   activos       lo que la empresa TIENE. Una fila por renglon del
--                 inventario. cantidad_total es cuantas unidades se poseen.
--
--   movimientos_bodega   lo que SE MUEVE. Una fila por salida o por entrada.
--
-- Lo disponible NO se guarda: se calcula restando. Guardarlo seria tener dos
-- numeros que dicen lo mismo, y el dia que uno falle nadie sabra cual creer.
-- ============================================================


-- ------------------------------------------------------------
-- 1 · Los activos
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.activos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  codigo text NOT NULL,
  elemento text NOT NULL,
  categoria text NOT NULL DEFAULT 'SIN CATEGORÍA',

  -- Cuantas unidades se poseen. La mayoria del inventario son piezas sueltas
  -- con codigo propio y cantidad 1; los cables, tornilleria y dotacion van a
  -- granel y llegan a pasar de 200.
  cantidad_total integer NOT NULL DEFAULT 1 CHECK (cantidad_total >= 0),

  -- Unidades fuera de servicio: dañadas, en reparacion o prestadas sin
  -- evento. No estan disponibles pero siguen siendo de la empresa.
  en_mantenimiento integer NOT NULL DEFAULT 0 CHECK (en_mantenimiento >= 0),

  precio_unitario numeric(14,2) NOT NULL DEFAULT 0,
  valor_mercado numeric(14,2) NOT NULL DEFAULT 0,
  depreciacion numeric(14,2) NOT NULL DEFAULT 0,

  ubicacion text,
  notas text,

  -- De donde salio la fila. Lo importado del Excel queda marcado por lote,
  -- y eso es lo que permite volver a correr una parte de la importacion sin
  -- duplicar nada: la parte borra lo suyo y lo vuelve a meter. Lo que se
  -- crea a mano desde el panel queda en NULL y no lo toca ninguna
  -- importacion.
  origen text,

  -- Renglones que llegaron del Excel con algo raro y hay que mirar con calma.
  -- Se importan igual: perder una fila es peor que importarla marcada.
  revisar boolean NOT NULL DEFAULT false,
  revisar_motivo text,

  -- Baja del inventario. No se borra: un activo dado de baja sigue teniendo
  -- historia de movimientos que alguien puede necesitar consultar.
  activo boolean NOT NULL DEFAULT true,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

COMMENT ON TABLE public.activos IS
  'Lo que la empresa posee. Lo disponible no se guarda aqui: se calcula restando los movimientos abiertos.';
COMMENT ON COLUMN public.activos.cantidad_total IS
  'Unidades que se poseen. 1 para piezas con codigo propio, mas para lo que va a granel.';
COMMENT ON COLUMN public.activos.revisar IS
  'Marcado en la importacion cuando el renglon del Excel traia algo dudoso (codigo repetido, cantidad en cero).';

-- El codigo es como busca la gente en bodega, y la categoria es el filtro de
-- todos los dias. Sin estos indices cada busqueda recorre 1.151 filas.
CREATE INDEX IF NOT EXISTS activos_por_codigo ON public.activos (codigo);
CREATE INDEX IF NOT EXISTS activos_por_categoria ON public.activos (categoria) WHERE activo;

-- A proposito NO es UNIQUE: el Excel trae cinco codigos repetidos, y tres de
-- ellos son equipos distintos con el mismo numero. Forzar la unicidad aqui
-- obligaria a inventarse codigos durante la importacion, que es como se
-- pierde la trazabilidad contra el inventario fisico. Quedan marcados con
-- revisar = true y se corrigen desde el panel.


-- ------------------------------------------------------------
-- 2 · Los movimientos
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.movimientos_bodega (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  activo_id uuid NOT NULL REFERENCES public.activos(id) ON DELETE CASCADE,

  -- salida: sale de bodega.        entrada: vuelve.
  -- alta:   entra al inventario.   baja: se descarta.
  -- ajuste: correccion de conteo tras un inventario fisico.
  tipo text NOT NULL CHECK (tipo IN ('salida','entrada','alta','baja','ajuste')),

  cantidad integer NOT NULL CHECK (cantidad > 0),

  -- A que evento salio. Puede ir vacio: tambien se presta equipo sin evento.
  project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL,
  -- El nombre del evento copiado al momento del movimiento. Igual que con el
  -- productor: si el evento se borra o se renombra, el historico de bodega
  -- tiene que seguir diciendo a donde fue el equipo.
  evento_nombre text,

  responsable_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  responsable_nombre text NOT NULL,

  fecha timestamptz NOT NULL DEFAULT now(),
  notas text,

  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.movimientos_bodega IS
  'Cada salida y cada entrada de bodega. De aqui sale lo que esta en la calle y la hoja de vida de cada equipo.';
COMMENT ON COLUMN public.movimientos_bodega.evento_nombre IS
  'Nombre del evento al momento del movimiento. Se copia para que el historico sobreviva a que el evento se renombre o se borre.';

CREATE INDEX IF NOT EXISTS movimientos_por_activo
  ON public.movimientos_bodega (activo_id, fecha DESC);
CREATE INDEX IF NOT EXISTS movimientos_por_evento
  ON public.movimientos_bodega (project_id) WHERE project_id IS NOT NULL;


-- ------------------------------------------------------------
-- 3 · Que hay disponible  (una vista, no una columna)
-- ------------------------------------------------------------
-- Disponible = lo que se tiene, menos lo que esta afuera, menos lo que esta
-- en mantenimiento. "Afuera" es la suma de salidas menos la suma de entradas:
-- si salieron 4 y volvieron 3, hay 1 en la calle.
CREATE OR REPLACE VIEW public.activos_disponibilidad AS
SELECT
  a.*,
  COALESCE(mov.fuera, 0) AS en_evento,
  GREATEST(a.cantidad_total - COALESCE(mov.fuera, 0) - a.en_mantenimiento, 0) AS disponible
FROM public.activos a
LEFT JOIN (
  SELECT activo_id,
         SUM(CASE WHEN tipo = 'salida'  THEN cantidad
                  WHEN tipo = 'entrada' THEN -cantidad
                  ELSE 0 END) AS fuera
  FROM public.movimientos_bodega
  GROUP BY activo_id
) mov ON mov.activo_id = a.id;

COMMENT ON VIEW public.activos_disponibilidad IS
  'Los activos con lo que esta afuera y lo que queda libre, calculado a partir de los movimientos.';


-- ------------------------------------------------------------
-- 4 · Quien puede entrar
-- ------------------------------------------------------------
-- La regla vive en la base, no solo en la pantalla: esconder un boton no
-- impide que alguien llame la API por su cuenta.
CREATE OR REPLACE FUNCTION public.puede_bodega()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
      AND (
        ur.role::text = 'administrador'
        OR 'bodega' = ANY(COALESCE(ur.allowed_panels, ARRAY[]::text[]))
      )
  );
$$;

COMMENT ON FUNCTION public.puede_bodega() IS
  'Administradores y quien tenga el panel bodega entre sus paneles permitidos.';

ALTER TABLE public.activos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.movimientos_bodega ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Bodega lee activos" ON public.activos;
CREATE POLICY "Bodega lee activos" ON public.activos
  FOR SELECT TO authenticated USING (public.puede_bodega());

DROP POLICY IF EXISTS "Bodega escribe activos" ON public.activos;
CREATE POLICY "Bodega escribe activos" ON public.activos
  FOR INSERT TO authenticated WITH CHECK (public.puede_bodega());

DROP POLICY IF EXISTS "Bodega actualiza activos" ON public.activos;
CREATE POLICY "Bodega actualiza activos" ON public.activos
  FOR UPDATE TO authenticated USING (public.puede_bodega()) WITH CHECK (public.puede_bodega());

-- Borrar un activo no esta permitido a nadie desde la aplicacion: se da de
-- baja con activo = false. Un activo borrado se lleva su historia por delante.

DROP POLICY IF EXISTS "Bodega lee movimientos" ON public.movimientos_bodega;
CREATE POLICY "Bodega lee movimientos" ON public.movimientos_bodega
  FOR SELECT TO authenticated USING (public.puede_bodega());

DROP POLICY IF EXISTS "Bodega registra movimientos" ON public.movimientos_bodega;
CREATE POLICY "Bodega registra movimientos" ON public.movimientos_bodega
  FOR INSERT TO authenticated WITH CHECK (public.puede_bodega());

-- Un movimiento no se edita ni se borra: se corrige con otro movimiento en
-- sentido contrario. Asi el historico dice lo que de verdad paso, incluidos
-- los errores y su correccion.


-- ------------------------------------------------------------
-- 5 · updated_at al dia
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.toca_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS trg_activos_updated_at ON public.activos;
CREATE TRIGGER trg_activos_updated_at
  BEFORE UPDATE ON public.activos
  FOR EACH ROW EXECUTE FUNCTION public.toca_updated_at();


-- ------------------------------------------------------------
-- Comprobacion
-- ------------------------------------------------------------
SELECT 'activos' AS tabla, count(*) FROM public.activos
UNION ALL
SELECT 'movimientos', count(*) FROM public.movimientos_bodega;
