import { Project } from "@/types";
import { listaDeProductores } from "@/components/ProductorSelect";
import { COLORES_PROYECTO, colorVisualDeEvento } from "@/lib/coloresProyecto";
import { costosResueltos } from "@/lib/costosEvento";

/**
 * Alerta roja: eventos que ya arrancaron y a los que nadie les cargo los
 * costos. Un evento que todavia no empieza no se marca: no esta atrasado.
 *
 * Arranca con octubre de 2026 a proposito. Antes de esa fecha los costos se
 * llevaban por fuera del planner, asi que pintar de rojo todo el historico
 * seria una pared roja que nadie va a atender y que termina ensenando a
 * ignorar el color.
 *
 * Solo se mira si el evento quedo resuelto, no cuanto suma: resuelto es tener
 * costos cargados, o que alguien haya marcado que no tuvo costos de terceros.
 * Lo que se persigue es que nadie deje el evento sin tocar, no que todos
 * tengan que gastar.
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

  // Resuelto es tener costos cargados O haber declarado que no hubo de
  // terceros. Sin lo segundo, un evento hecho con equipo propio se quedaba en
  // rojo para siempre.
  return !costosResueltos(proyecto.costos);
}

/**
 * Quien ve TODOS los eventos sin costos, no solo los suyos.
 *
 * Es por correo y no por rol: Abraham tambien es administrador y lo que se
 * pidio es que vea unicamente lo suyo. Agregar a alguien aqui es una linea.
 */
const VEN_TODO = ["bayron.bocanegra@bbmproducciones.com.co"];

export function veTodosLosEventos(correo?: string | null): boolean {
  const c = (correo || "").trim().toLowerCase();
  return !!c && VEN_TODO.includes(c);
}

/**
 * A que comercial pertenece un correo, segun los colores.
 *
 * Usa el mismo criterio que colorVisualDeEvento para atribuir un evento por
 * su autor: el correo empieza por el nombre del comercial y un punto
 * ("abraham.varela@..." -> Abraham). Asi el dueno del evento y el dueno de la
 * alerta se calculan igual y nunca discrepan.
 */
function comercialDelCorreo(correo?: string | null): string | null {
  const c = (correo || "").trim().toLowerCase();
  if (!c) return null;
  const encontrado = COLORES_PROYECTO.find(
    (col) => col.comercial && c.startsWith(col.comercial.toLowerCase() + ".")
  );
  return encontrado?.comercial ?? null;
}

/**
 * El evento es de esta persona?
 *
 * Lo es por dos caminos, y basta uno: lleva su color (el puesto a mano, y si
 * no hay, el que sale de quien subio el evento), o esta asignada como
 * productor. Con el color solo no alcanzaba: Diego y Laura no son comerciales
 * y se habrian quedado sin ninguna alerta.
 */
export function esSuProyecto(
  proyecto: Project,
  nombreDelUsuario?: string | null,
  correoDelUsuario?: string | null
): boolean {
  const nombre = (nombreDelUsuario || "").trim().toLowerCase();
  if (nombre && listaDeProductores(proyecto.productor).some((n) => n.toLowerCase() === nombre)) {
    return true;
  }

  const mio = comercialDelCorreo(correoDelUsuario);
  if (!mio) return false;
  const visual = colorVisualDeEvento(proyecto);
  return visual?.nombre?.toLowerCase() === mio.toLowerCase();
}

/**
 * Le toca a quien esta mirando?
 *
 * Cada quien ve en rojo lo suyo y nada mas, para que la alerta siga queriendo
 * decir "esto lo tienes que hacer tu". La excepcion esta en VEN_TODO: alguien
 * tiene que ver los que no son de nadie.
 *
 * No se usa el rol: Abraham tambien es administrador, y con la regla anterior
 * veia los dieciocho eventos de la empresa en rojo en vez de los suyos.
 */
export function alertaVisiblePara(
  proyecto: Project,
  opciones: {
    nombreDelUsuario?: string | null;
    correoDelUsuario?: string | null;
  }
): boolean {
  if (!eventoVencidoSinCostos(proyecto)) return false;
  if (veTodosLosEventos(opciones.correoDelUsuario)) return true;
  return esSuProyecto(proyecto, opciones.nombreDelUsuario, opciones.correoDelUsuario);
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
  opciones: { nombreDelUsuario?: string | null; correoDelUsuario?: string | null }
): boolean {
  if (!eventoVencidoSinCostos(proyecto)) return false;
  return esSuProyecto(proyecto, opciones.nombreDelUsuario, opciones.correoDelUsuario);
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
