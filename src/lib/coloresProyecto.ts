/**
 * Color de fila: es a la vez la marca visual y la atribucion de la venta.
 *
 * Se pinta toda la fila y alimenta la grafica de ventas. Amarillo es Bayron,
 * azul es Abraham. El rojo es una marca libre, para lo que haga falta
 * senalar; no pertenece a ningun comercial y no entra en las barras.
 *
 * Los colores de la grafica no son los mismos del swatch: un amarillo vivo se
 * ve bien como punto pero pierde contraste como barra. Los de abajo pasaron el
 * validador de paletas en claro y en oscuro.
 */

export interface ColorProyecto {
  /** Lo que se guarda en projects.color. */
  valor: string;
  nombre: string;
  /** Comercial al que pertenece, o null si es solo una marca. */
  comercial: string | null;
  /** Color de la barra en tema claro. */
  graficaClaro: string;
  /** Color de la barra en tema oscuro. */
  graficaOscuro: string;
}

export const COLORES_PROYECTO: ColorProyecto[] = [
  {
    valor: "#eab308",
    nombre: "Bayron",
    comercial: "Bayron",
    graficaClaro: "#a16207",
    graficaOscuro: "#b8860b",
  },
  {
    valor: "#3b82f6",
    nombre: "Abraham",
    comercial: "Abraham",
    graficaClaro: "#2563eb",
    graficaOscuro: "#3b82f6",
  },
  {
    valor: "#ef4444",
    nombre: "Marca roja",
    comercial: null,
    graficaClaro: "#dc2626",
    graficaOscuro: "#ef4444",
  },
];

/** Solo los colores que representan a un comercial: los que salen en la grafica. */
export const COLORES_DE_COMERCIAL = COLORES_PROYECTO.filter((c) => c.comercial !== null);

export function buscarColor(valor?: string | null): ColorProyecto | null {
  if (!valor) return null;
  const limpio = valor.trim().toLowerCase();
  return COLORES_PROYECTO.find((c) => c.valor.toLowerCase() === limpio) ?? null;
}

/** Nombre legible de un color guardado. */
export function nombreDeColor(valor?: string | null): string | null {
  if (!valor) return null;
  return buscarColor(valor)?.nombre ?? "Otro color";
}

/**
 * Fondo suave para la fila. No se usa el color puro porque el texto encima
 * quedaria ilegible.
 */
export function fondoDeColor(valor?: string | null, alpha = 0.16): string | undefined {
  if (!valor) return undefined;
  const hex = valor.trim().replace("#", "");
  if (hex.length !== 6) return undefined;
  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);
  if ([r, g, b].some(Number.isNaN)) return undefined;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/** Estilo de fila para la matriz. undefined si el proyecto no tiene color. */
export function estiloFilaPorColor(proyecto: unknown): React.CSSProperties | undefined {
  const color = (proyecto as { color?: string | null } | null | undefined)?.color;
  const fondo = fondoDeColor(color);
  return fondo ? { backgroundColor: fondo } : undefined;
}

/**
 * Color con el que se dibuja un evento fuera de la matriz: en el calendario,
 * por ejemplo. Manda el color puesto a mano; si no hay, se usa el del autor.
 * Devuelve null cuando el evento no tiene ninguno de los dos.
 */
export function colorVisualDeEvento(
  proyecto: unknown
): { color: string; nombre: string } | null {
  const manual = buscarColor((proyecto as { color?: string | null } | null)?.color);
  if (manual) return { color: manual.valor, nombre: manual.nombre };

  const correo = (proyecto as { createdByEmail?: string | null } | null)?.createdByEmail;
  const porAutor = COLORES_PROYECTO.find(
    (c) => c.comercial && correo?.toLowerCase().startsWith(c.comercial.toLowerCase() + ".")
  );
  return porAutor ? { color: porAutor.valor, nombre: porAutor.nombre } : null;
}

/**
 * Franja y etiqueta de color para la fila o la tarjeta. Manda el color puesto
 * a mano; si no hay, el del autor. Sustituye a accentPorAutor, que solo miraba
 * el correo y por eso dejaba sin marca a los eventos pintados a mano.
 */
export function acentoVisualDeEvento(
  proyecto: unknown
): { color: string; label: string } | null {
  const visual = colorVisualDeEvento(proyecto);
  return visual ? { color: visual.color, label: visual.nombre } : null;
}

/**
 * Fondo de la fila con el mismo criterio que el acento: color manual primero,
 * autor despues. Asi la fila y su franja nunca discrepan.
 */
export function estiloFilaVisual(proyecto: unknown): React.CSSProperties | undefined {
  const visual = colorVisualDeEvento(proyecto);
  const fondo = fondoDeColor(visual?.color);
  return fondo ? { backgroundColor: fondo } : undefined;
}
