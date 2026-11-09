import { Project } from "@/types";

/**
 * Quien maneja las facturas de los eventos.
 *
 * Subir la factura, cambiar su numero o marcar "No se factura" lo pueden
 * hacer solo estas personas. La misma lista esta en la base de datos (funcion
 * `puede_gestionar_factura`), que es la que de verdad lo impide: esta copia
 * solo sirve para no mostrar botones que la base va a rechazar.
 * Si se cambia aqui, hay que cambiarla tambien alla.
 */
export const RESPONSABLE_FACTURAS = "administrativo@bbmproducciones.com.co";

export const GESTORES_FACTURA = [
  RESPONSABLE_FACTURAS,
  "auxbbm@gmail.com",
  "abraham.varela@bbmproducciones.com.co",
  "gerencia.administrativa@bbmproducciones.com.co",
  "contabilidadbbm@gmail.com",
  "bayron.bocanegra@bbmproducciones.com.co",
];

const norm = (email?: string | null) => (email || "").trim().toLowerCase();

export const puedeGestionarFactura = (email?: string | null) =>
  GESTORES_FACTURA.includes(norm(email));

/** Solo el responsable recibe el aviso de facturas pendientes. */
export const esResponsableFacturas = (email?: string | null) =>
  norm(email) === RESPONSABLE_FACTURAS;

/**
 * Desde cuando se exige la factura. Los ~200 eventos anteriores se manejaron
 * con el numero escrito a mano; si entraran al aviso, el aviso no serviria.
 */
export const FACTURA_OBLIGATORIA_DESDE = "2026-11-01";

const hoyBogota = () =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "America/Bogota" }).format(new Date());

/**
 * Evento ya ejecutado (su ultimo dia de ejecucion ya paso) desde la fecha de
 * corte, sin factura subida y sin marcar "No se factura".
 */
export function faltaFactura(p: Project): boolean {
  if (p.isDeleted) return false;
  if (p.factura?.archivo) return false;
  if (p.estadoFacturacion === "no_se_factura") return false;
  const fin = (p.fechaEjecucionFin || p.fechaEjecucionInicio || "").slice(0, 10);
  if (!fin) return false;
  return fin >= FACTURA_OBLIGATORIA_DESDE && fin < hoyBogota();
}
