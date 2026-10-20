import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { logger } from "@/lib/logger";

export interface UsuarioRegistrado {
  id: string;
  nombre: string;
  /** Correo con el que entra al planner. Vacio si no se pudo leer. */
  correo?: string;
}

/**
 * Los usuarios del planner, para escoger responsables.
 *
 * Se lee una sola vez por sesion y se guarda aqui: la lista cambia cada varios
 * meses y se dibuja una vez por fila de la matriz. Sin la cache, abrir el
 * Panel Directivo pediria lo mismo doscientas veces.
 */
let cache: UsuarioRegistrado[] | null = null;
let enVuelo: Promise<UsuarioRegistrado[]> | null = null;

async function traer(): Promise<UsuarioRegistrado[]> {
  const { data, error } = await supabase
    .from("profiles")
    .select("id, full_name")
    .order("full_name");

  if (error) {
    logger.debug("[useUsuariosRegistrados] no se pudo leer profiles:", error.message);
    return [];
  }

  // El correo vive en user_roles, no en profiles. Se trae para poder amarrar
  // el usuario con su ficha de empleado: los nombres no coinciden (el usuario
  // dice "Abraham Varela" y la ficha dice "abraham.varela"), pero el correo
  // es el mismo en los dos lados. Si falla, se sigue sin correo: sirve para
  // afinar, no es indispensable.
  const correos = new Map<string, string>();
  const { data: roles, error: errorRoles } = await supabase
    .from("user_roles")
    .select("user_id, email");
  if (errorRoles) {
    logger.debug("[useUsuariosRegistrados] sin correos:", errorRoles.message);
  } else {
    for (const r of roles || []) {
      if (r.user_id && r.email) correos.set(r.user_id, String(r.email).trim());
    }
  }

  // Un perfil sin nombre no sirve para escoger: no hay que mostrar en la lista.
  // Se arregla poniendole el nombre desde Gestion de Usuarios.
  return (data || [])
    .filter((p) => (p.full_name || "").trim().length > 0)
    .map((p) => ({
      id: p.id,
      nombre: (p.full_name as string).trim(),
      correo: correos.get(p.id) || "",
    }));
}

export function useUsuariosRegistrados() {
  const [usuarios, setUsuarios] = useState<UsuarioRegistrado[]>(cache || []);
  const [cargando, setCargando] = useState(cache === null);

  useEffect(() => {
    if (cache !== null) return;
    let vivo = true;
    if (!enVuelo) enVuelo = traer();
    enVuelo
      .then((lista) => {
        cache = lista;
        if (vivo) setUsuarios(lista);
      })
      .finally(() => {
        enVuelo = null;
        if (vivo) setCargando(false);
      });
    return () => {
      vivo = false;
    };
  }, []);

  return { usuarios, cargando };
}
