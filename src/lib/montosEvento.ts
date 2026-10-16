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

/**
 * A que dia pertenece la venta de un evento.
 *
 * Es la fecha en que el evento SE EJECUTA, no en la que se monta. Un stand que
 * se arma el 30 de octubre y se ejecuta el 1 de noviembre es una venta de
 * noviembre: el montaje es trabajo previo, no es cuando se vende.
 *
 * Cuando la ejecucion cruza de mes, manda el dia en que arranca. Es la misma
 * regla que usa la grafica de Ventas por comercial, para que los dos paneles
 * no digan cifras distintas del mismo mes.
 */
export function fechaDeVenta(p: Project): Date | null {
  const valor = p.fechaEjecucionInicio;
  if (!valor) return null;
  // Se arma con la fecha suelta y hora cero local: parsear "2026-11-01" como
  // UTC corre el dia hacia atras en Bogota y la venta cae en octubre.
  const d = new Date(valor.length > 10 ? valor : `${valor}T00:00:00`);
  return isNaN(d.getTime()) ? null : d;
}

/** Si la venta de un evento cae dentro del periodo que se esta mirando. */
export function ventaEnRango(p: Project, rango?: { start: Date; end: Date }): boolean {
  if (!rango) return true;
  const f = fechaDeVenta(p);
  if (!f) return false;
  return f >= rango.start && f <= rango.end;
}
