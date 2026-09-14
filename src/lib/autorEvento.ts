/**
 * Color por autor del evento.
 *
 * Cada evento guarda el correo de quien lo creo (columna created_by_email,
 * sellada por el servidor). Aqui se traduce ese correo a un color para que
 * se distinga de un vistazo en la matriz y en el calendario.
 *
 * Para sumar a alguien mas, basta agregar una linea en AUTORES.
 */

export interface AutorEvento {
  /** Correo en minusculas. */
  email: string;
  /** Como se muestra en las etiquetas. */
  nombre: string;
  /** Color solido, para barras y puntos. */
  color: string;
  /** Clases para la etiqueta con el nombre. */
  chip: string;
}

const AUTORES: Record<string, AutorEvento> = {
  "abraham.varela@bbmproducciones.com.co": {
    email: "abraham.varela@bbmproducciones.com.co",
    nombre: "Abraham",
    color: "#2563eb",
    chip: "bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/40",
  },
  "bayron.bocanegra@bbmproducciones.com.co": {
    email: "bayron.bocanegra@bbmproducciones.com.co",
    nombre: "Bayron",
    color: "#ca8a04",
    chip: "bg-yellow-500/20 text-yellow-800 dark:text-yellow-300 border-yellow-500/40",
  },
};

/** Lista para las leyendas. */
export const AUTORES_EVENTO: AutorEvento[] = Object.values(AUTORES);

/**
 * Devuelve el autor de un evento, o null si no hay correo guardado
 * (eventos creados antes de este cambio) o si el correo no esta en la lista.
 */
export function autorDeEvento(proyecto: unknown): AutorEvento | null {
  const correo = (proyecto as { createdByEmail?: string | null } | null | undefined)
    ?.createdByEmail;
  const email = typeof correo === "string" ? correo.trim().toLowerCase() : "";
  if (!email) return null;
  return AUTORES[email] ?? null;
}

/**
 * Franja de color para la fila de la matriz. Se pasa tal cual a
 * MatrixTable mediante la prop getRowAccent.
 */
export function accentPorAutor(
  proyecto: unknown
): { color: string; label: string } | null {
  const autor = autorDeEvento(proyecto);
  if (!autor) return null;
  return { color: autor.color, label: `Creado por ${autor.nombre}` };
}
