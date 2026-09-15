-- Que el productor solo lo pueda cambiar quien edita el Panel Directivo.
--
-- Esconder la casilla en los otros paneles no es un permiso: es una sugerencia.
-- Quien sepa manejar la base puede escribir igual. Este disparador lo revisa
-- del lado del servidor, que es donde cuenta.
--
-- Solo mira el productor: cualquier otro campo del proyecto se sigue editando
-- como siempre, desde el panel que corresponda.
CREATE OR REPLACE FUNCTION public.solo_directivo_cambia_productor()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.productor IS DISTINCT FROM OLD.productor THEN
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

DROP TRIGGER IF EXISTS trg_solo_directivo_cambia_productor ON public.projects;

CREATE TRIGGER trg_solo_directivo_cambia_productor
BEFORE UPDATE ON public.projects
FOR EACH ROW
EXECUTE FUNCTION public.solo_directivo_cambia_productor();

-- Comprobacion: el disparador debe quedar sobre projects.
SELECT tgname AS disparador, tgenabled AS estado
FROM pg_trigger
WHERE tgrelid = 'public.projects'::regclass
  AND NOT tgisinternal
ORDER BY tgname;
