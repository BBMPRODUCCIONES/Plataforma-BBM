import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

/**
 * Los datos de bodega.
 *
 * Se leen de la vista activos_disponibilidad y no de la tabla: la vista ya
 * trae calculado cuanto esta afuera y cuanto queda libre. Si el panel hiciera
 * esa resta por su cuenta, el dia que cambie la regla habria que cambiarla en
 * dos sitios y uno de los dos se quedaria atras.
 */

export interface Activo {
  id: string;
  codigo: string;
  elemento: string;
  categoria: string;
  cantidad_total: number;
  en_mantenimiento: number;
  precio_unitario: number;
  valor_mercado: number;
  depreciacion: number;
  ubicacion: string | null;
  notas: string | null;
  revisar: boolean;
  revisar_motivo: string | null;
  activo: boolean;
  /** Unidades que estan fuera de bodega ahora mismo. Lo calcula la vista. */
  en_evento: number;
  /** Lo que se puede comprometer para un evento nuevo. Lo calcula la vista. */
  disponible: number;
  updated_at: string;
}

export interface Movimiento {
  id: string;
  activo_id: string;
  tipo: "salida" | "entrada" | "alta" | "baja" | "ajuste";
  cantidad: number;
  project_id: string | null;
  evento_nombre: string | null;
  responsable_id: string | null;
  responsable_nombre: string;
  fecha: string;
  notas: string | null;
}

/** Lo que hace falta para registrar un movimiento. */
export interface NuevoMovimiento {
  activo_id: string;
  tipo: Movimiento["tipo"];
  cantidad: number;
  project_id?: string | null;
  evento_nombre?: string | null;
  notas?: string | null;
}

export function useBodega() {
  const { user } = useAuth();
  const [activos, setActivos] = useState<Activo[]>([]);
  const [movimientos, setMovimientos] = useState<Movimiento[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    setCargando(true);
    setError(null);

    // PostgREST devuelve como maximo 1.000 filas por consulta y no avisa de
    // nada: simplemente manda menos. Con 1.151 activos eso dejaba 151 equipos
    // invisibles en el panel, y como los totales se calculan sobre lo que
    // llego, el inventario aparecia 258 millones por debajo de lo que vale.
    // Se pide por paginas hasta que una venga incompleta.
    //
    // El orden lleva "id" al final a proposito: categoria y elemento se
    // repiten, y sin un desempate unico dos paginas consecutivas pueden
    // traer la misma fila o saltarse una.
    const traerActivos = async () => {
      const PAGINA = 1000;
      const todo: Activo[] = [];
      for (let desde = 0; desde < 50000; desde += PAGINA) {
        const { data, error } = await supabase
          .from("activos_disponibilidad" as never)
          .select("*")
          .order("categoria")
          .order("elemento")
          .order("id")
          .range(desde, desde + PAGINA - 1);
        if (error) return { data: null, error };
        const pagina = (data as unknown as Activo[]) || [];
        todo.push(...pagina);
        if (pagina.length < PAGINA) break;
      }
      return { data: todo, error: null };
    };

    const [a, m] = await Promise.all([
      traerActivos(),
      // El historico completo no se trae: en un año son miles de filas y el
      // panel solo necesita lo reciente. La hoja de vida de un equipo pide
      // sus movimientos aparte.
      supabase
        .from("movimientos_bodega" as never)
        .select("*")
        .order("fecha", { ascending: false })
        .limit(400),
    ]);

    if (a.error) {
      console.error("[bodega] activos:", a.error);
      setError(a.error.message);
    } else {
      setActivos(a.data || []);
    }
    if (m.error) console.error("[bodega] movimientos:", m.error);
    else setMovimientos((m.data as unknown as Movimiento[]) || []);

    setCargando(false);
  }, []);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  /** El nombre con el que se firma el movimiento. */
  const nombreDelResponsable = useCallback(async (): Promise<string> => {
    if (!user) return "Alguien";
    const { data } = await supabase
      .from("profiles")
      .select("full_name")
      .eq("id", user.id)
      .maybeSingle();
    return (data?.full_name || "").trim() || user.email || "Alguien";
  }, [user]);

  /**
   * Registrar una salida o una entrada.
   *
   * La salida se rechaza si no hay unidades libres. Esa comprobacion vive
   * aqui para poder decirlo con palabras y no dejar que la base acepte un
   * negativo silencioso; la cuenta de verdad la sigue haciendo la vista al
   * recargar, asi que dos personas moviendo al tiempo no se descuadran.
   */
  const registrarMovimiento = useCallback(
    async (mov: NuevoMovimiento): Promise<boolean> => {
      const act = activos.find((x) => x.id === mov.activo_id);
      if (!act) {
        toast.error("No se encontró el equipo");
        return false;
      }
      if (mov.tipo === "salida" && mov.cantidad > act.disponible) {
        toast.error(
          `Solo hay ${act.disponible} disponible(s) de ${act.elemento}`,
          { description: "Revisa si algo no ha vuelto de un evento anterior." }
        );
        return false;
      }
      if (mov.tipo === "entrada" && mov.cantidad > act.en_evento) {
        toast.error(
          `De ${act.elemento} solo hay ${act.en_evento} afuera`,
          { description: "No se puede devolver más de lo que salió." }
        );
        return false;
      }

      const responsable_nombre = await nombreDelResponsable();
      const { error: e } = await supabase.from("movimientos_bodega" as never).insert({
        activo_id: mov.activo_id,
        tipo: mov.tipo,
        cantidad: mov.cantidad,
        project_id: mov.project_id ?? null,
        evento_nombre: mov.evento_nombre ?? null,
        responsable_id: user?.id ?? null,
        responsable_nombre,
        notas: mov.notas ?? null,
      } as never);

      if (e) {
        console.error("[bodega] movimiento:", e);
        toast.error("No se pudo registrar", { description: e.message });
        return false;
      }
      await cargar();
      return true;
    },
    [activos, cargar, nombreDelResponsable, user]
  );

  const guardarActivo = useCallback(
    async (datos: Partial<Activo>, id?: string): Promise<boolean> => {
      const fila = {
        codigo: (datos.codigo || "").trim(),
        elemento: (datos.elemento || "").trim(),
        categoria: (datos.categoria || "SIN CATEGORÍA").trim(),
        cantidad_total: Number(datos.cantidad_total) || 0,
        en_mantenimiento: Number(datos.en_mantenimiento) || 0,
        precio_unitario: Number(datos.precio_unitario) || 0,
        valor_mercado: Number(datos.valor_mercado) || 0,
        depreciacion: Number(datos.depreciacion) || 0,
        ubicacion: datos.ubicacion || null,
        notas: datos.notas || null,
        revisar: Boolean(datos.revisar),
        revisar_motivo: datos.revisar_motivo || null,
        activo: datos.activo !== false,
      };

      const q = id
        ? supabase.from("activos" as never).update(fila as never).eq("id", id).select()
        : supabase.from("activos" as never).insert({ ...fila, created_by: user?.id ?? null } as never).select();

      const { data, error: e } = await q;
      if (e) {
        console.error("[bodega] guardar activo:", e);
        toast.error("No se pudo guardar", { description: e.message });
        return false;
      }
      // Una actualizacion bloqueada por permisos no devuelve error: devuelve
      // cero filas. Sin este chequeo el panel diria "guardado" sin guardar.
      if (!data || (data as unknown[]).length === 0) {
        toast.error("No se guardó", {
          description: "Tu usuario no tiene permiso para modificar la bodega.",
        });
        return false;
      }
      await cargar();
      return true;
    },
    [cargar, user]
  );

  /** Los movimientos de un equipo: su hoja de vida. */
  const historial = useCallback(async (activoId: string): Promise<Movimiento[]> => {
    const { data, error: e } = await supabase
      .from("movimientos_bodega" as never)
      .select("*")
      .eq("activo_id", activoId)
      .order("fecha", { ascending: false });
    if (e) {
      toast.error("No se pudo leer el historial", { description: e.message });
      return [];
    }
    return (data as unknown as Movimiento[]) || [];
  }, []);

  const categorias = useMemo(
    () => [...new Set(activos.map((a) => a.categoria))].sort((x, y) => x.localeCompare(y, "es")),
    [activos]
  );

  /** Los numeros de la cabecera. Salen de los mismos datos de la tabla. */
  const resumen = useMemo(() => {
    const vivos = activos.filter((a) => a.activo);
    const suma = (f: (a: Activo) => number) => vivos.reduce((t, a) => t + f(a), 0);
    return {
      renglones: vivos.length,
      unidades: suma((a) => a.cantidad_total),
      enEvento: suma((a) => a.en_evento),
      disponibles: suma((a) => a.disponible),
      enMantenimiento: suma((a) => a.en_mantenimiento),
      porRevisar: vivos.filter((a) => a.revisar).length,
      valorCompra: suma((a) => Number(a.precio_unitario) * a.cantidad_total),
      valorMercado: suma((a) => Number(a.valor_mercado)),
      depreciacion: suma((a) => Number(a.depreciacion)),
    };
  }, [activos]);

  return {
    activos,
    movimientos,
    categorias,
    resumen,
    cargando,
    error,
    recargar: cargar,
    registrarMovimiento,
    guardarActivo,
    historial,
  };
}
