import { Project } from "@/types";
import { costosResueltos, huellaDeCostos } from "@/lib/costosEvento";
import { COSTOS_SE_EXIGEN_DESDE } from "@/lib/alertaCostos";

/**
 * Revision de costos y centros de costos.
 *
 * auxbbm@ es quien sube los centros de costos y quien verifica que los
 * costos cargados por los productores esten bien. Solo el recibe el aviso.
 * Verificar tambien lo puede hacer Bayron (administrador). La base de datos
 * tiene la misma lista (funcion `puede_verificar_costos`) y es la que lo hace
 * cumplir; si se cambia aqui, hay que cambiarla alla.
 */
export const RESPONSABLE_COSTOS = "auxbbm@gmail.com";

const VERIFICADORES = [RESPONSABLE_COSTOS, "bayron.bocanegra@bbmproducciones.com.co"];

const norm = (e?: string | null) => (e || "").trim().toLowerCase();

export const puedeVerificarCostos = (email?: string | null) => VERIFICADORES.includes(norm(email));
export const esResponsableCostos = (email?: string | null) => norm(email) === RESPONSABLE_COSTOS;

/** Desde cuando se piden centros de costos en el aviso. */
export const CENTRO_COSTOS_SE_EXIGE_DESDE = "2026-09-01";

export type EstadoVerificacion = "sin_costos" | "sin_verificar" | "verificado" | "cambiaron";

export function estadoVerificacion(p: Project): EstadoVerificacion {
  if (!costosResueltos(p.costos)) return "sin_costos";
  const v = p.costosVerificacion;
  if (!v?.en) return "sin_verificar";
  return v.huella === huellaDeCostos(p.costos) ? "verificado" : "cambiaron";
}

/** Tiene costos cargados que nadie ha verificado (o que cambiaron despues). */
export function costosPorVerificar(p: Project): boolean {
  if (p.isDeleted) return false;
  const inicio = (p.fechaEjecucionInicio || "").slice(0, 10);
  if (!inicio || inicio < COSTOS_SE_EXIGEN_DESDE) return false;
  const e = estadoVerificacion(p);
  return e === "sin_verificar" || e === "cambiaron";
}

/** Evento sin centro de costos. Incluye los futuros: el centro se necesita antes de gastar. */
export function faltaCentroCostos(p: Project): boolean {
  if (p.isDeleted) return false;
  const inicio = (p.fechaEjecucionInicio || "").slice(0, 10);
  if (!inicio || inicio < CENTRO_COSTOS_SE_EXIGE_DESDE) return false;
  return !(p.centroCostos || "").trim();
}
