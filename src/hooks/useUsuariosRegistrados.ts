import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { logger } from "@/lib/logger";

export interface UsuarioRegistrado {
  id: string;
  nombre: string;
  /** Correo con el que entra al planner. Vacio si no se pudo leer. */
  correo?: string;
  /** Ficha de empleado amarrada por correo (si existe). */
  empleadoId?: string;
  cargo?: string;
  cedula?: string;
}

/**
 * Los usuarios del planner, para escoger responsables y personal.
 *
 * Se guarda en memoria para no pedir lo mismo una vez por fila de la matriz,
 * pero ya NO para toda la sesion: antes se leia una sola vez y en el celular,
 * con la app instalada abierta dias enteros, un usuario nuevo o un nombre
 * corregido no aparecia nunca. Ahora la copia dura un minuto, y se vuelve a
 * pedir al abrir el selector y al volver a la app.
 */
const VIGENCIA_MS = 60_000;
let cache: UsuarioRegistrado[] | null = null;
let leidoEn = 0;
let enVuelo: Promise<UsuarioRegistrado[]> | null = null;
const oyentes = new Set<(l: UsuarioRegistrado[]) => void>();

async function traer(): Promise<UsuarioRegistrado[]> {
  // La funcion de la base devuelve nombre, correo y ficha de empleado para
  // cualquiera del equipo. Leyendo las tablas directo, los operativos no
  // podian ver los correos (user_roles es solo para administradores), asi que
  // a ellos nunca se les amarraba la ficha ni el cargo.
  const { data: rpc, error: errRpc } = await supabase.rpc(
    "usuarios_para_asignar" as never
  );
  if (!errRpc && Array.isArray(rpc)) {
    return (rpc as Array<Record<string, string | null>>)
      .filter((u) => (u.nombre || "").trim().length > 0)
      .map((u) => ({
        id: String(u.id),
        nombre: String(u.nombre).trim(),
        correo: u.correo || "",
        empleadoId: u.empleado_id || undefined,
        cargo: u.cargo || "",
        cedula: u.cedula || "",
      }));
  }
  if (errRpc) logger.debug("[useUsuariosRegistrados] rpc:", errRpc.message);

  const { data, error } = await supabase.from("profiles").select("id, full_name").order("full_name");
  if (error) {
    logger.debug("[useUsuariosRegistrados] no se pudo leer profiles:", error.message);
    return cache || [];
  }
  const correos = new Map<string, string>();
  const { data: roles } = await supabase.from("user_roles").select("user_id, email");
  for (const r of roles || []) {
    if (r.user_id && r.email) correos.set(r.user_id, String(r.email).trim());
  }
  return (data || [])
    .filter((p) => (p.full_name || "").trim().length > 0)
    .map((p) => ({ id: p.id, nombre: (p.full_name as string).trim(), correo: correos.get(p.id) || "" }));
}

/** Pide la lista otra vez si la copia ya vencio (o siempre, con forzar). */
export function refrescarUsuarios(forzar = false): Promise<UsuarioRegistrado[]> {
  if (!forzar && cache !== null && Date.now() - leidoEn < VIGENCIA_MS) return Promise.resolve(cache);
  if (!enVuelo) {
    enVuelo = traer()
      .then((lista) => {
        cache = lista;
        leidoEn = Date.now();
        oyentes.forEach((f) => f(lista));
        return lista;
      })
      .finally(() => {
        enVuelo = null;
      });
  }
  return enVuelo;
}

// Al volver a la app (desbloquear el celular, cambiar de pestana) se revisa.
if (typeof document !== "undefined") {
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible" && cache !== null) void refrescarUsuarios();
  });
}

export function useUsuariosRegistrados() {
  const [usuarios, setUsuarios] = useState<UsuarioRegistrado[]>(cache || []);
  const [cargando, setCargando] = useState(cache === null);

  useEffect(() => {
    let vivo = true;
    const oir = (l: UsuarioRegistrado[]) => vivo && setUsuarios(l);
    oyentes.add(oir);
    refrescarUsuarios().finally(() => vivo && setCargando(false));
    return () => {
      vivo = false;
      oyentes.delete(oir);
    };
  }, []);

  const recargar = useCallback(() => refrescarUsuarios(true), []);
  return { usuarios, cargando, recargar };
}
