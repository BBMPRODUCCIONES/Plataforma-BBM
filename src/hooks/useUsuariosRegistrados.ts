import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { logger } from "@/lib/logger";

export interface UsuarioRegistrado {
  id: string;
  nombre: string;
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

  // Un perfil sin nombre no sirve para escoger: no hay que mostrar en la lista.
  // Se arregla poniendole el nombre desde Gestion de Usuarios.
  return (data || [])
    .filter((p) => (p.full_name || "").trim().length > 0)
    .map((p) => ({ id: p.id, nombre: (p.full_name as string).trim() }));
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
