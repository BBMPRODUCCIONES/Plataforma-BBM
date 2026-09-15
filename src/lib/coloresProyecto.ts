/**
 * Colores manuales de proyecto.
 *
 * Se pintan sobre toda la fila de la matriz. Sirven para marcar a mano los
 * eventos que ya estaban cargados antes de que existiera el color por autor,
 * o para cualquier clasificacion propia del Panel Directivo.
 *
 * Solo el Panel Directivo permite asignarlos; el color se ve en todos los paneles.
 */

export interface ColorProyecto {
  /** Lo que se guarda en la base. */
  valor: string;
  nombre: string;
}

export const COLORES_PROYECTO: ColorProyecto[] = [
  { valor: "#ef4444", nombre: "Rojo" },
  { valor: "#f97316", nombre: "Naranja" },
  { valor: "#eab308", nombre: "Amarillo" },
  { valor: "#22c55e", nombre: "Verde" },
  { valor: "#06b6d4", nombre: "Turquesa" },
  { valor: "#3b82f6", nombre: "Azul" },
  { valor: "#a855f7", nombre: "Morado" },
  { valor: "#ec4899", nombre: "Rosa" },
  { valor: "#78716c", nombre: "Gris" },
];

/** Busca el nombre legible de un color guardado. */
export function nombreDeColor(valor?: string | null): string | null {
  if (!valor) return null;
  return COLORES_PROYECTO.find((c) => c.valor.toLowerCase() === valor.toLowerCase())?.nombre ?? "Personalizado";
}

/**
 * Convierte el color a un fondo suave, legible en tema claro y oscuro.
 * No se usa el color puro porque el texto encima quedaria ilegible.
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

/** Estilo de fila para la matriz. Devuelve undefined si el proyecto no tiene color. */
export function estiloFilaPorColor(proyecto: unknown): React.CSSProperties | undefined {
  const color = (proyecto as { color?: string | null } | null | undefined)?.color;
  const fondo = fondoDeColor(color);
  return fondo ? { backgroundColor: fondo } : undefined;
}
