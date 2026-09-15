/**
 * Comerciales de BBM, para atribuir la venta de cada evento.
 *
 * Los colores pasaron el validador de paletas: separacion suficiente para
 * daltonismo y contraste contra el fondo, tanto en tema claro como oscuro.
 * Son dos juegos distintos a proposito: un amarillo que se lee bien sobre
 * blanco se apaga sobre negro, y al reves.
 *
 * Para sumar a alguien, agrega una linea aqui y listo.
 */

export interface Comercial {
  /** Lo que se guarda en la base. */
  valor: string;
  nombre: string;
  /** Color en tema claro. */
  colorClaro: string;
  /** Color en tema oscuro. */
  colorOscuro: string;
}

export const COMERCIALES: Comercial[] = [
  { valor: "bayron",  nombre: "Bayron",  colorClaro: "#a16207", colorOscuro: "#b8860b" },
  { valor: "abraham", nombre: "Abraham", colorClaro: "#2563eb", colorOscuro: "#3b82f6" },
];

/** Etiqueta para las filas sin comercial asignado. */
export const SIN_COMERCIAL = "Sin asignar";

export function buscarComercial(valor?: string | null): Comercial | null {
  if (!valor) return null;
  const limpio = valor.trim().toLowerCase();
  return COMERCIALES.find((c) => c.valor === limpio) ?? null;
}

export function nombreComercial(valor?: string | null): string {
  return buscarComercial(valor)?.nombre ?? SIN_COMERCIAL;
}

/** Inicial para el boton compacto de la matriz. */
export function inicialComercial(valor?: string | null): string {
  const c = buscarComercial(valor);
  return c ? c.nombre.charAt(0).toUpperCase() : "—";
}

export function colorComercial(valor: string | null | undefined, oscuro: boolean): string | undefined {
  const c = buscarComercial(valor);
  if (!c) return undefined;
  return oscuro ? c.colorOscuro : c.colorClaro;
}
