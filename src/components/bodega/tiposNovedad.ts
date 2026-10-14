import { TipoGeneral, TipoNovedad } from "@/hooks/useBodega";

/**
 * Los ocho tipos en un solo sitio: cuatro que cuelgan de un equipo y cuatro
 * de la bodega en general. Viven juntos porque la etiqueta y el color se usan
 * en los dos paneles, y tenerlos repetidos es como se desincronizan.
 */
export type TipoCualquiera = TipoNovedad | TipoGeneral;

export interface DefTipo {
  valor: TipoCualquiera;
  etiqueta: string;
  pista: string;
}

/** Los de un equipo del inventario. */
export const TIPOS_EQUIPO: DefTipo[] = [
  { valor: "dano", etiqueta: "Daño", pista: "Se rompió, se golpeó o llegó averiado." },
  { valor: "observacion", etiqueta: "Observación", pista: "Algo que anotar sin que sea daño: desgaste, una pieza floja." },
  { valor: "mantenimiento", etiqueta: "Mantenimiento", pista: "Entró a revisión o reparación. Describe qué se le hizo." },
  { valor: "baja", etiqueta: "Pérdida o baja", pista: "No volvió del evento, se perdió o se descartó." },
];

/** Los de la bodega, que no apuntan a ningún equipo. */
export const TIPOS_GENERAL: DefTipo[] = [
  { valor: "compra", etiqueta: "Por comprar", pista: "Hace falta en bodega y hay que conseguirlo." },
  { valor: "general", etiqueta: "Observación general", pista: "Cualquier anotación de bodega que no sea de un equipo puntual." },
  { valor: "reparar", etiqueta: "Por reparar", pista: "Hay que mandarlo a arreglar afuera." },
  { valor: "mejora", etiqueta: "Mejora o idea", pista: "Organización, estantería, marcación, cómo se guarda algo." },
];

export const ETIQUETA: Record<TipoCualquiera, string> = {
  dano: "Daño",
  observacion: "Observación",
  mantenimiento: "Mantenimiento",
  baja: "Pérdida o baja",
  compra: "Por comprar",
  general: "Observación general",
  reparar: "Por reparar",
  mejora: "Mejora o idea",
};

/**
 * El color dice qué tan urgente es, no de qué categoría es. Por eso la baja y
 * la compra comparten el rojo y el ámbar con los daños: las dos son plata.
 */
export const COLOR: Record<TipoCualquiera, string> = {
  dano: "border-amber-500/40 text-amber-700 dark:text-amber-500",
  observacion: "border-sky-500/40 text-sky-700 dark:text-sky-400",
  mantenimiento: "border-violet-500/40 text-violet-700 dark:text-violet-400",
  baja: "border-destructive/40 text-destructive",
  compra: "border-emerald-500/40 text-emerald-700 dark:text-emerald-400",
  general: "border-sky-500/40 text-sky-700 dark:text-sky-400",
  reparar: "border-violet-500/40 text-violet-700 dark:text-violet-400",
  mejora: "border-muted-foreground/40 text-muted-foreground",
};

/** dd mmm aaaa sin depender de la zona del navegador: la fecha ya viene suelta. */
export function fechaLegible(iso: string) {
  const [a, m, d] = iso.split("-").map(Number);
  const meses = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
  return `${d} ${meses[(m || 1) - 1]} ${a}`;
}

/** Hoy en Bogotá, que es donde pasan las cosas, no donde esté el navegador. */
export function hoyBogota() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Bogota", year: "numeric", month: "2-digit", day: "2-digit",
  }).format(new Date());
}
