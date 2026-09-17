import { Project } from "@/types";

/**
 * Los montos de un evento, con el IVA separado.
 *
 * En la ficha del evento hay dos cifras: "Ingreso bruto", que es la base antes
 * de IVA, y "Ingreso total", que es lo que el cliente paga, IVA incluido. Las
 * graficas venian sumando el total, y eso infla las ventas: el IVA no es plata
 * de BBM, se recauda y se gira. Dos comerciales con la misma venta real pero
 * uno con cliente exento se veian distintos.
 *
 * Reglas, en orden:
 *  - Si hay bruto y el total es mayor, la base es el bruto y el IVA es la
 *    diferencia. No se asume 19%: se usa lo que diga la cotizacion, que es lo
 *    que de verdad se factura (hay eventos exentos, y hay bases mixtas).
 *  - Si hay bruto pero el total no es mayor (falta, o quedaron iguales), la
 *    base es el bruto y el IVA es cero.
 *  - Si no hay bruto, la base es el total y el IVA queda en cero, pero el
 *    evento se marca como "sin discriminar": no es que no tenga IVA, es que no
 *    sabemos cuanto. Se cuenta aparte para poder avisar en pantalla en vez de
 *    presentar un numero incompleto como si estuviera completo.
 */
export interface MontosEvento {
  /** Venta sin IVA. Es la cifra con la que se mide a un comercial. */
  base: number;
  /** IVA facturado, cuando se puede saber. */
  iva: number;
  /** Lo que paga el cliente. */
  total: number;
  /** true cuando el evento no trae bruto y el IVA no se puede separar. */
  sinDiscriminar: boolean;
}

export function montosDelEvento(p: Project): MontosEvento {
  const bruto = Number(p.ingresoBruto) || 0;
  const total = Number(p.ingresoTotal) || 0;

  if (bruto > 0) {
    const iva = total > bruto ? total - bruto : 0;
    return { base: bruto, iva, total: bruto + iva, sinDiscriminar: false };
  }

  return { base: total, iva: 0, total, sinDiscriminar: total > 0 };
}

/** Suma los montos de varios eventos, contando cuantos quedaron sin discriminar. */
export function sumarMontos(proyectos: Project[]) {
  let base = 0;
  let iva = 0;
  let total = 0;
  let sinDiscriminar = 0;

  for (const p of proyectos) {
    const m = montosDelEvento(p);
    base += m.base;
    iva += m.iva;
    total += m.total;
    if (m.sinDiscriminar) sinDiscriminar += 1;
  }

  return { base, iva, total, sinDiscriminar };
}
