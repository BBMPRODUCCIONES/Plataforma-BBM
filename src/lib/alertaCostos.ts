import { Project } from "@/types";
import { listaDeProductores } from "@/components/ProductorSelect";

/**
 * Alerta roja: eventos ya ejecutados a los que nadie les cargo los costos.
 *
 * Arranca con octubre de 2026 a proposito. Antes de esa fecha los costos se
 * llevaban por fuera del planner, asi que pintar de rojo todo el historico
 * seria una pared roja que nadie va a atender y que termina ensenando a
 * ignorar el color.
 *
 * Solo se mira si hay lineas de costo cargadas, no cuanto suman: un evento
 * puede cerrar en cero (lo cubrio otro contrato, se hizo con equipo propio) y
 * eso es una decision, no un olvido. Lo que se esta persiguiendo es que nadie
 * deje el evento sin tocar.
 */

/** Desde cuando se persiguen los costos. Formato ISO, dia incluido. */
export const COSTOS_SE_EXIGEN_DESDE = "2026-10-01";

/** La fecha con la que se decide si el evento ya paso. */
function finDeEjecucion(p: Project): Date | null {
  const valor = p.fechaEjecucionFin || p.fechaEjecucionInicio;
  if (!valor) return null;
  const d = new Date(valor.length > 10 ? valor : `${valor}T23:59:59`);
  return isNaN(d.getTime()) ? null : d;
}

/**
 * El evento deberia tener costos cargados y no los tiene.
 *
 * No mira quien esta viendo la pantalla: eso lo decide `alertaVisiblePara`.
 */
export function eventoVencidoSinCostos(proyecto: Project, ahora: Date = new Date()): boolean {
  if (proyecto.isDeleted) return false;

  // Sin productor no hay a quien avisarle. Fue lo que se pidio: la alerta es
  // para el productor asignado, no un reporte general de eventos sin costos.
  if (listaDeProductores(proyecto.productor).length === 0) return false;

  const inicio = proyecto.fechaEjecucionInicio || "";
  if (!inicio || inicio.slice(0, 10) < COSTOS_SE_EXIGEN_DESDE) return false;

  const fin = finDeEjecucion(proyecto);
  if (!fin || fin > ahora) return false;

  return (proyecto.costos || []).length === 0;
}

/**
 * Le toca a quien esta mirando?
 *
 * El productor ve en rojo lo suyo y nada mas, para que la alerta siga
 * queriendo decir "esto lo tienes que hacer tu". El administrador las ve
 * todas, porque es quien persigue a los demas.
 */
export function alertaVisiblePara(
  proyecto: Project,
  opciones: { nombreDelUsuario?: string | null; esAdministrador?: boolean }
): boolean {
  if (!eventoVencidoSinCostos(proyecto)) return false;
  if (opciones.esAdministrador) return true;

  const nombre = (opciones.nombreDelUsuario || "").trim().toLowerCase();
  if (!nombre) return false;
  return listaDeProductores(proyecto.productor).some((n) => n.toLowerCase() === nombre);
}
