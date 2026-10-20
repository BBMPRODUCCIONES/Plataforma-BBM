/**
 * Estado de facturacion: si el evento ya se cobro.
 *
 * Va aparte del estado del evento a proposito. `estado` dice en que va la
 * operacion (por planear, en progreso, ejecutado) y esto dice en que va el
 * cobro. Mientras estuvieron juntos en el mismo campo, 201 de 264 eventos
 * terminaron en "Facturado" y el estado dejo de decir nada sobre la
 * operacion: un evento facturado podia estar hecho o a medias y no habia
 * forma de saberlo.
 */

export type EstadoFacturacion =
  | "sin_definir"
  | "por_facturar"
  | "facturado"
  | "no_se_factura";

export const FACTURACION = [
  {
    value: "sin_definir" as const,
    label: "Sin definir",
    clase: "bg-muted text-muted-foreground",
  },
  {
    value: "por_facturar" as const,
    label: "Por Facturar",
    clase: "bg-violet-500/20 text-violet-400",
  },
  {
    value: "facturado" as const,
    label: "Facturado",
    clase: "bg-emerald-500/20 text-emerald-400",
  },
  {
    // Gris a proposito: no facturar no es un logro ni un problema, es un
    // evento que sale de la fila de cobro. En rojo pareceria un error.
    value: "no_se_factura" as const,
    label: "No se Factura",
    clase: "bg-slate-500/20 text-slate-400",
  },
];

export function normalizarFacturacion(valor?: string | null): EstadoFacturacion {
  if (!valor) return "sin_definir";
  return FACTURACION.some((f) => f.value === valor)
    ? (valor as EstadoFacturacion)
    : "sin_definir";
}

export function facturacionDe(valor?: string | null) {
  const v = normalizarFacturacion(valor);
  return FACTURACION.find((f) => f.value === v) ?? FACTURACION[0];
}
