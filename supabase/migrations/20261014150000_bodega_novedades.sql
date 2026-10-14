-- ============================================================
-- BODEGA · novedades: daños, observaciones, mantenimiento y bajas
-- ============================================================
-- Hasta ahora bodega sabia donde esta cada equipo, pero no en que estado.
-- Un Bose que volvio golpeado del sabado volvia a salir el martes sin que
-- nadie lo supiera, porque el unico rastro del golpe era que alguien se
-- acordara.
--
-- Una novedad no es un movimiento. El movimiento responde "donde esta";
-- la novedad responde "como esta". Por eso tabla aparte: meterlas en
-- movimientos_bodega ensuciaria la cuenta de lo disponible, que es lo
-- unico que esa tabla sabe hacer bien.
-- ============================================================


CREATE TABLE IF NOT EXISTS public.novedades_bodega (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  activo_id uuid NOT NULL REFERENCES public.activos(id) ON DELETE CASCADE,

  --   dano          se rompio, se golpeo, llego averiado
  --   observacion   algo que anotar sin que sea daño: desgaste, falta un tornillo
  --   mantenimiento entro a revision o a reparacion, con lo que se le hizo
  --   baja          no volvio, se perdio, se descarto
  tipo text NOT NULL CHECK (tipo IN ('dano','observacion','mantenimiento','baja')),

  descripcion text NOT NULL CHECK (length(btrim(descripcion)) > 0),

  -- La fecha del hecho, no la de la digitacion. Una novedad se anota el
  -- lunes aunque el golpe haya sido el sabado, y para cuadrar con el cliente
  -- lo que importa es el sabado. Por eso va aparte de created_at.
  fecha date NOT NULL DEFAULT ((now() AT TIME ZONE 'America/Bogota')::date),

  -- Cuantas unidades afecta. Va suelto a proposito: en un renglon de 223
  -- pines, que tres esten torcidos no es lo mismo que que lo esten todos.
  unidades integer CHECK (unidades IS NULL OR unidades > 0),

  -- En que evento paso, si paso en uno. El nombre se copia igual que en los
  -- movimientos: el historico tiene que sobrevivir a que el evento se borre.
  project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL,
  evento_nombre text,

  -- Rutas dentro del bucket bodega-novedades. Es una lista porque un golpe
  -- casi nunca se entiende con una sola foto.
  fotos jsonb NOT NULL DEFAULT '[]'::jsonb,

  -- Una novedad se cierra, no se borra: queda el historial de que paso y de
  -- como se resolvio.
  resuelta boolean NOT NULL DEFAULT false,
  resuelta_en timestamptz,
  resuelta_nota text,
  resuelta_por_nombre text,

  reportada_por uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reportada_por_nombre text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.novedades_bodega IS
  'Daños, observaciones, mantenimientos y bajas de cada equipo. Responde "como esta", no "donde esta".';
COMMENT ON COLUMN public.novedades_bodega.fecha IS
  'Fecha del hecho, no de la digitacion: la novedad se anota el lunes aunque el golpe fuera el sabado.';

-- Las dos consultas que de verdad se hacen: la hoja de vida de un equipo, y
-- el tablero de lo que sigue abierto.
CREATE INDEX IF NOT EXISTS novedades_por_activo
  ON public.novedades_bodega (activo_id, fecha DESC);
CREATE INDEX IF NOT EXISTS novedades_abiertas
  ON public.novedades_bodega (fecha DESC) WHERE NOT resuelta;


-- ------------------------------------------------------------
-- Quien puede verlas y escribirlas
-- ------------------------------------------------------------
ALTER TABLE public.novedades_bodega ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Bodega lee novedades" ON public.novedades_bodega;
CREATE POLICY "Bodega lee novedades" ON public.novedades_bodega
  FOR SELECT TO authenticated USING (public.puede_bodega());

DROP POLICY IF EXISTS "Bodega reporta novedades" ON public.novedades_bodega;
CREATE POLICY "Bodega reporta novedades" ON public.novedades_bodega
  FOR INSERT TO authenticated WITH CHECK (public.puede_bodega());

-- Se permite actualizar porque cerrar una novedad es un UPDATE. Lo que no
-- hay es DELETE: una novedad resuelta sigue siendo parte de la historia del
-- equipo, y es lo que sustenta un reclamo o una baja meses despues.
DROP POLICY IF EXISTS "Bodega cierra novedades" ON public.novedades_bodega;
CREATE POLICY "Bodega cierra novedades" ON public.novedades_bodega
  FOR UPDATE TO authenticated USING (public.puede_bodega()) WITH CHECK (public.puede_bodega());


-- ------------------------------------------------------------
-- Las fotos
-- ------------------------------------------------------------
-- Privado: una foto de bodega puede mostrar el monton de equipo de un
-- cliente. Se sirve con URL firmada desde la aplicacion.
INSERT INTO storage.buckets (id, name, public)
VALUES ('bodega-novedades', 'bodega-novedades', false)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Bodega ve fotos de novedades" ON storage.objects;
CREATE POLICY "Bodega ve fotos de novedades" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'bodega-novedades' AND public.puede_bodega());

DROP POLICY IF EXISTS "Bodega sube fotos de novedades" ON storage.objects;
CREATE POLICY "Bodega sube fotos de novedades" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'bodega-novedades' AND public.puede_bodega());

DROP POLICY IF EXISTS "Bodega borra fotos de novedades" ON storage.objects;
CREATE POLICY "Bodega borra fotos de novedades" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'bodega-novedades' AND public.puede_bodega());


-- ------------------------------------------------------------
-- Comprobacion
-- ------------------------------------------------------------
SELECT
  (SELECT count(*) FROM public.novedades_bodega)                              AS novedades,
  (SELECT count(*) FROM storage.buckets WHERE id = 'bodega-novedades')        AS bucket_creado,
  (SELECT count(*) FROM pg_policies
    WHERE tablename = 'novedades_bodega' AND schemaname = 'public')           AS politicas;
