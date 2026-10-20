import { ProjectStatus } from "@/types";

/**
 * Los estados de un evento. Son tres y describen la operacion, no el cobro.
 *
 * Antes habia siete: a los tres de ahora se sumaban "Por Ejecutar",
 * "Terminado", "Por Facturar", "Facturado" y "No se Factura". Los cuatro
 * ultimos mezclaban dos cosas distintas en el mismo campo: en que va el
 * evento y si ya se cobro. El resultado fue que el 83% de los eventos
 * quedaron en "Facturado" y el estado dejo de decir nada util sobre la
 * operacion.
 *
 * El cobro se lleva ahora en la columna #Factura: si tiene numero, se
 * facturo. Esa separacion es la que permite responder "que esta hecho pero
 * sin cobrar" sin inventar un estado nuevo.
 */
export const ESTADOS = [
  {
    value: "por_planear" as const,
    label: "Por Planear",
    /** Clases para el selector de la matriz. */
    clase: "bg-yellow-500/20 text-yellow-400",
    /** Clase del badge, definida en index.css. */
    badge: "status-pending",
    color: "hsl(48, 96%, 53%)",
  },
  {
    value: "en_progreso" as const,
    label: "En Progreso",
    clase: "bg-blue-500/20 text-blue-400",
    badge: "status-active",
    color: "hsl(217, 91%, 60%)",
  },
  {
    value: "ejecutado" as const,
    label: "Ejecutado",
    clase: "bg-green-500/20 text-green-400",
    badge: "status-completed",
    color: "hsl(142, 71%, 45%)",
  },
];

/**
 * Equivalencias de los estados viejos.
 *
 * Los eventos que habia se pasaron a los tres nuevos de una vez, asi que esta
 * tabla no deberia hacer falta. Se deja porque un evento puede llegar con un
 * estado viejo igual: alguien con la pagina abierta desde antes del cambio,
 * una copia guardada sin conexion, o una fila que se restaure de un respaldo.
 * Sin esta tabla ese evento se dibujaria sin etiqueta y sin color, que es
 * peor que mostrarlo en el estado que le corresponde.
 *
 * "Por Ejecutar" cae en Por Planear: el evento todavia no ha pasado.
 * "Terminado", "Por Facturar", "Facturado" y "No se Factura" caen en
 * Ejecutado: en los cuatro el evento ya se hizo.
 */
const EQUIVALENCIAS: Record<string, ProjectStatus> = {
  por_ejecutar: "por_planear",
  terminado: "ejecutado",
  pendiente_facturar: "ejecutado",
  facturado: "ejecutado",
  no_se_factura: "ejecutado",
};

/** Lleva cualquier estado, viejo o nuevo, a uno de los tres de hoy. */
export function normalizarEstado(valor?: string | null): ProjectStatus {
  if (!valor) return "por_planear";
  if (ESTADOS.some((e) => e.value === valor)) return valor as ProjectStatus;
  return EQUIVALENCIAS[valor] ?? "por_planear";
}

export function estadoDe(valor?: string | null) {
  const v = normalizarEstado(valor);
  return ESTADOS.find((e) => e.value === v) ?? ESTADOS[0];
}

export function etiquetaDeEstado(valor?: string | null): string {
  return estadoDe(valor).label;
}

export function colorDeEstado(valor?: string | null): string {
  return estadoDe(valor).color;
}
