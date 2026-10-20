import { Project } from "@/types";
import { listaDeProductores } from "@/components/ProductorSelect";

/**
 * Alerta roja: eventos que ya arrancaron y a los que nadie les cargo los
 * costos. Un evento que todavia no empieza no se marca: no esta atrasado.
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

/**
 * Desde cuando se le puede exigir los costos a un evento.
 *
 * Es el dia en que ARRANCA la ejecucion, no el dia en que termina. Con el dia
 * de cierre, un evento de dos dias que empieza hoy no se marcaba hasta pasado
 * manana, que es justo cuando el productor todavia se acuerda de lo que pago.
 * Esperar a que termine es esperar a que se olvide.
 */
function arranqueDeEjecucion(p: Project): Date | null {
  const valor = p.fechaEjecucionInicio;
  if (!valor) return null;
  const d = new Date(valor.length > 10 ? valor : `${valor}T00:00:00`);
  return isNaN(d.getTime()) ? null : d;
}

/**
 * El evento deberia tener costos cargados y no los tiene.
 *
 * No mira quien esta viendo la pantalla: eso lo decide `alertaVisiblePara`.
 */
export function eventoVencidoSinCostos(proyecto: Project, ahora: Date = new Date()): boolean {
  if (proyecto.isDeleted) return false;

  // Un evento sin productor asignado tambien cuenta. En la primera version se
  // excluia, y el resultado fue que de 17 eventos de octubre sin costos solo
  // se veian 6: los otros 11 no tenian productor y desaparecian justo cuando
  // son los mas faciles de olvidar, porque no hay nadie responsable.

  const inicio = proyecto.fechaEjecucionInicio || "";
  if (!inicio || inicio.slice(0, 10) < COSTOS_SE_EXIGEN_DESDE) return false;

  const arranque = arranqueDeEjecucion(proyecto);
  if (!arranque || arranque > ahora) return false;

  return (proyecto.costos || []).length === 0;
}

/** El evento esta asignado a esta persona como productor? */
export function esSuProyecto(proyecto: Project, nombreDelUsuario?: string | null): boolean {
  const nombre = (nombreDelUsuario || "").trim().toLowerCase();
  if (!nombre) return false;
  return listaDeProductores(proyecto.productor).some((n) => n.toLowerCase() === nombre);
}

/**
 * Le toca a quien esta mirando?
 *
 * El productor ve en rojo lo suyo y nada mas, para que la alerta siga
 * queriendo decir "esto lo tienes que hacer tu". El administrador las ve
 * todas, incluidas las que no tienen productor: alguien tiene que verlas.
 */
export function alertaVisiblePara(
  proyecto: Project,
  opciones: { nombreDelUsuario?: string | null; esAdministrador?: boolean }
): boolean {
  if (!eventoVencidoSinCostos(proyecto)) return false;
  if (opciones.esAdministrador) return true;
  return esSuProyecto(proyecto, opciones.nombreDelUsuario);
}

/**
 * Parpadea? Solo en los eventos propios del productor.
 *
 * El parpadeo es para que no se pueda pasar por alto lo que uno mismo tiene
 * pendiente. Si parpadearan los diecisiete que ve el administrador, la
 * pantalla entera se mueve y deja de significar algo.
 */
export function alertaParpadea(
  proyecto: Project,
  opciones: { nombreDelUsuario?: string | null }
): boolean {
  if (!eventoVencidoSinCostos(proyecto)) return false;
  return esSuProyecto(proyecto, opciones.nombreDelUsuario);
}

/** De una lista, cuantos no tienen productor asignado. */
export function cuantosSinProductor(proyectos: Project[]): number {
  return proyectos.filter((p) => listaDeProductores(p.productor).length === 0).length;
}

/** "octubre de 2026" a partir de la fecha de ejecucion, para agrupar el aviso. */
export function mesDeEjecucion(proyecto: Project): string {
  const v = proyecto.fechaEjecucionInicio || "";
  if (v.length < 7) return "sin fecha";
  const [anio, mes] = v.slice(0, 7).split("-");
  const nombres = [
    "enero", "febrero", "marzo", "abril", "mayo", "junio",
    "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
  ];
  const i = Number(mes) - 1;
  return `${nombres[i] ?? mes} de ${anio}`;
}
