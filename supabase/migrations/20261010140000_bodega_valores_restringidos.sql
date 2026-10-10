-- ============================================================
-- BODEGA · el valor de los equipos solo para quien debe verlo
-- ============================================================
-- Hasta ahora, cualquiera que entrara al Panel de Bodega veia lo que vale el
-- inventario: 879 millones de pesos. Eso son siete personas, porque la
-- funcion puede_bodega() deja pasar a todo administrador.
--
-- Esto lo baja a dos. Y lo hace en la base, no en la pantalla: esconder una
-- columna en React no esconde el dato, porque el navegador igual lo recibio
-- y cualquiera que abra la consola lo lee. Aqui los precios salen en NULL
-- desde el servidor, asi que al navegador de los demas nunca llegan.
-- ============================================================


-- ------------------------------------------------------------
-- 1 · Quien ve los valores
-- ------------------------------------------------------------
-- Va por correo y no por rol a proposito: el permiso es de dos personas, no
-- de un cargo. Si manana hay que sumar a alguien, se agrega el correo aqui.
CREATE OR REPLACE FUNCTION public.puede_ver_valores_bodega()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM auth.users u
    WHERE u.id = auth.uid()
      AND lower(u.email) IN (
        'bayron.bocanegra@bbmproducciones.com.co',
        'bbmadministracion86@gmail.com'
      )
  );
$$;

COMMENT ON FUNCTION public.puede_ver_valores_bodega() IS
  'Solo estas dos personas ven lo que vale cada equipo. El resto entra a bodega igual, pero sin cifras.';

GRANT EXECUTE ON FUNCTION public.puede_ver_valores_bodega() TO authenticated;


-- ------------------------------------------------------------
-- 2 · La vista devuelve NULL en las cifras a quien no debe verlas
-- ------------------------------------------------------------
-- Se enumeran las columnas una por una en vez de usar a.*: es la unica forma
-- de envolver tres de ellas en un CASE. El orden es el de la tabla, porque
-- CREATE OR REPLACE VIEW no admite reordenar ni renombrar.
DROP VIEW IF EXISTS public.activos_disponibilidad;

CREATE VIEW public.activos_disponibilidad AS
SELECT
  a.id,
  a.codigo,
  a.elemento,
  a.categoria,
  a.cantidad_total,
  a.en_mantenimiento,
  CASE WHEN public.puede_ver_valores_bodega() THEN a.precio_unitario END AS precio_unitario,
  CASE WHEN public.puede_ver_valores_bodega() THEN a.valor_mercado   END AS valor_mercado,
  CASE WHEN public.puede_ver_valores_bodega() THEN a.depreciacion    END AS depreciacion,
  a.ubicacion,
  a.notas,
  a.origen,
  a.revisar,
  a.revisar_motivo,
  a.activo,
  a.created_at,
  a.updated_at,
  a.created_by,
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
  'Los activos con lo que esta afuera y lo que queda libre. Las tres columnas de dinero salen en NULL salvo para quien puede verlas.';

-- La vista corre con los permisos de quien pregunta, no con los del dueño.
-- Asi las politicas de activos y de movimientos siguen aplicando a traves de
-- ella: quien no tiene bodega no obtiene filas, ni por la API. El enmascarado
-- de las cifras no depende de esto: lo hace una funcion SECURITY DEFINER, que
-- responde igual para cualquiera que la llame.
ALTER VIEW public.activos_disponibilidad SET (security_invoker = on);

GRANT SELECT ON public.activos_disponibilidad TO authenticated;


-- ------------------------------------------------------------
-- 3 · Quien no ve las cifras tampoco las puede pisar
-- ------------------------------------------------------------
-- Sin esto, esconder los valores seria una forma de perderlos: el panel manda
-- el activo completo al guardar, y un usuario que recibio NULL en los precios
-- los devolveria como cero. Guardaria "bien" y borraria el valor del equipo
-- sin que nadie se entere hasta cuadrar el inventario meses despues.
--
-- El trigger no falla ni avisa: simplemente conserva lo que ya habia. El
-- usuario edita la ubicacion o las notas, se guarda lo que si cambio, y las
-- cifras quedan como estaban.
CREATE OR REPLACE FUNCTION public.protege_valores_bodega()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.puede_ver_valores_bodega() THEN
    NEW.precio_unitario := OLD.precio_unitario;
    NEW.valor_mercado   := OLD.valor_mercado;
    NEW.depreciacion    := OLD.depreciacion;
  END IF;
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.protege_valores_bodega() IS
  'Si quien edita no ve los precios, los precios no cambian. Evita que un NULL enmascarado vuelva como cero.';

DROP TRIGGER IF EXISTS trg_activos_protege_valores ON public.activos;
CREATE TRIGGER trg_activos_protege_valores
  BEFORE UPDATE ON public.activos
  FOR EACH ROW EXECUTE FUNCTION public.protege_valores_bodega();


-- ------------------------------------------------------------
-- Comprobacion
-- ------------------------------------------------------------
-- Corriendo esto como tu, "ve_valores" debe salir true y el total cuadrar en
-- 879.000.401. Para cualquier otro usuario, los mismos SELECT dan NULL y 0.
SELECT
  public.puede_ver_valores_bodega() AS ve_valores,
  count(*)                          AS renglones,
  COALESCE(sum(precio_unitario * cantidad_total), 0) AS valor_compra
FROM public.activos_disponibilidad
WHERE activo;
