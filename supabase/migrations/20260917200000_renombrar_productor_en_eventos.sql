-- Al renombrar a un usuario, los eventos que lo tenian como productor se
-- actualizan solos.
--
-- El evento guarda el nombre del productor como texto, copiado al momento de
-- asignarlo. Eso hace que todo lo demas (tablas, calendario, filtros, orden de
-- produccion) lo lea sin trabajo, pero tiene un costo que ya se sintio:
-- cambiarle el nombre a alguien en Gestion de Usuarios dejaba los eventos
-- diciendo el nombre viejo, y la columna Productor quedaba desactualizada sin
-- que nadie se enterara.
--
-- Va en la base y no en la pantalla por dos razones. Una, asi vale para
-- cualquier via por la que se renombre, no solo por el boton. Dos, el
-- disparador que cuida quien asigna productores exige permiso de Panel
-- Directivo, y un administrador que solo maneja usuarios no lo tiene: hecho
-- desde el navegador, el cambio se habria rechazado con un error que no
-- explica nada.

-- El disparador del productor deja pasar el cambio cuando viene de un
-- renombre. La marca vive solo dentro de la transaccion (el tercer argumento
-- de set_config), asi que no queda abierta para nada mas.
CREATE OR REPLACE FUNCTION public.solo_directivo_cambia_productor()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.productor IS DISTINCT FROM OLD.productor THEN
    IF coalesce(current_setting('bbm.renombrando_productor', true), '') = 'si' THEN
      RETURN NEW;
    END IF;

    -- auth.uid() nulo = la llamada viene del servidor (edge functions, cargas,
    -- mantenimiento), no de una persona en el navegador. Esas ya son de fiar.
    IF auth.uid() IS NOT NULL AND NOT EXISTS (
      SELECT 1
      FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.role::text IN ('administrador', 'operativo')
        AND COALESCE(ur.puede_editar_directivo, false)
    ) THEN
      RAISE EXCEPTION 'El productor del evento solo se asigna desde el Panel Directivo.'
        USING ERRCODE = '42501';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.renombrar_productor_en_eventos()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  viejo text := trim(coalesce(OLD.full_name, ''));
  nuevo text := trim(coalesce(NEW.full_name, ''));
BEGIN
  -- Sin nombre viejo no hay nada que buscar, y sin nombre nuevo no se borra
  -- lo que hay: dejar los eventos sin productor por vaciar un perfil seria
  -- perder informacion que nadie pidio perder.
  IF viejo = '' OR nuevo = '' OR lower(viejo) = lower(nuevo) THEN
    RETURN NEW;
  END IF;

  PERFORM set_config('bbm.renombrando_productor', 'si', true);

  -- Un evento puede llevar varios productores separados por coma, asi que se
  -- reemplaza el nombre como elemento de esa lista y no como texto suelto:
  -- un replace() sobre la cadena entera dañaria a alguien cuyo nombre sea
  -- parte del de otro.
  UPDATE public.projects p
  SET productor = recalculado.lista
  FROM (
    SELECT
      x.id,
      (
        SELECT string_agg(
                 CASE WHEN lower(trim(e.nombre)) = lower(viejo) THEN nuevo ELSE trim(e.nombre) END,
                 ', ' ORDER BY e.orden
               )
        FROM unnest(string_to_array(x.productor, ',')) WITH ORDINALITY AS e(nombre, orden)
        WHERE trim(e.nombre) <> ''
      ) AS lista
    FROM public.projects x
    WHERE x.productor IS NOT NULL
      AND EXISTS (
        SELECT 1
        FROM unnest(string_to_array(x.productor, ',')) AS y(nombre)
        WHERE lower(trim(y.nombre)) = lower(viejo)
      )
  ) AS recalculado
  WHERE p.id = recalculado.id
    AND recalculado.lista IS NOT NULL;

  PERFORM set_config('bbm.renombrando_productor', '', true);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_renombrar_productor_en_eventos ON public.profiles;

CREATE TRIGGER trg_renombrar_productor_en_eventos
AFTER UPDATE OF full_name ON public.profiles
FOR EACH ROW
WHEN (OLD.full_name IS DISTINCT FROM NEW.full_name)
EXECUTE FUNCTION public.renombrar_productor_en_eventos();

-- Comprobacion: deben quedar los dos disparadores, cada uno en su tabla.
SELECT c.relname AS tabla, t.tgname AS disparador
FROM pg_trigger t
JOIN pg_class c ON c.oid = t.tgrelid
WHERE NOT t.tgisinternal
  AND t.tgname IN ('trg_renombrar_productor_en_eventos', 'trg_solo_directivo_cambia_productor')
ORDER BY 1, 2;
