import { Project } from "@/types";
import { listaDeProductores } from "@/components/ProductorSelect";
import { COLORES_DE_COMERCIAL, colorVisualDeEvento } from "@/lib/coloresProyecto";
import { costosResueltos, lineasReales } from "@/lib/costosEvento";
import { montosDelEvento } from "@/lib/montosEvento";
import { RESPONSABLE_FACTURAS } from "@/lib/permisosFactura";
import { RESPONSABLE_COSTOS } from "@/lib/permisosCostos";

/**
 * Productividad del equipo: que le toca a cada quien en el planner, que tiene
 * pendiente y si lo hace a tiempo.
 *
 * Las tareas AUTOMATICAS salen de los eventos (no hay que crearlas): cada
 * regla dice quien es el responsable, para cuando debe estar y cuando se hizo.
 * Las MANUALES son las que Bayron crea (tabla `tareas`) y se suman aqui.
 *
 * "A tiempo" = hecha a mas tardar el dia limite (hora Bogota). Cuando el
 * sistema no guarda el momento en que se hizo algo (centro de costos, valor de
 * la cotizacion) la tarea cuenta como hecha pero no entra en el calculo de
 * a tiempo / tarde.
 */

/** Solo Bayron entra a este apartado. */
export const DUENO_PRODUCTIVIDAD = "bayron.bocanegra@bbmproducciones.com.co";
export const puedeVerProductividad = (email?: string | null) =>
  (email || "").trim().toLowerCase() === DUENO_PRODUCTIVIDAD;

export type TipoTarea =
  | "costos"
  | "personal"
  | "factura"
  | "centro_costos"
  | "verificar_costos"
  | "valor_cotizacion"
  | "productor"
  | "manual";

export const NOMBRE_TAREA: Record<TipoTarea, string> = {
  costos: "Cargar costos del evento",
  personal: "Asignar personal del evento",
  factura: "Subir la factura",
  centro_costos: "Subir el centro de costos",
  verificar_costos: "Verificar y cerrar los costos",
  valor_cotizacion: "Cargar el valor de la cotización",
  productor: "Asignar productor al evento",
  manual: "Tarea asignada",
};

/** Plazos (dias) de cada tarea automatica. */
export const PLAZOS = {
  costosDiasDespuesDelEvento: 3,
  facturaDiasDespuesDelEvento: 5,
  verificarDiasDespuesDeCargados: 5,
};

/** Desde cuando se mide cada cosa (antes se llevaba por fuera del planner). */
export const MEDIR_DESDE = {
  costos: "2026-10-01",
  personal: "2026-11-01",
  factura: "2026-11-01",
  centro_costos: "2026-09-01",
  verificar_costos: "2026-10-01",
  valor_cotizacion: "2026-10-01",
  productor: "2026-10-01",
};

export interface Persona {
  /** Clave estable: correo en minusculas, o el nombre si no tiene correo. */
  clave: string;
  nombre: string;
  correo?: string;
  /** id del usuario (profiles) cuando tiene cuenta. */
  usuarioId?: string;
}

export interface Tarea {
  id: string;
  tipo: TipoTarea;
  titulo: string;
  detalle?: string;
  responsable: string; // clave de Persona
  responsableNombre: string;
  /** YYYY-MM-DD: dia del evento (o de la tarea manual), para filtrar por mes. */
  fecha: string;
  /** YYYY-MM-DD */
  limite: string | null;
  hecha: boolean;
  /** YYYY-MM-DD, cuando se sabe. */
  hechaEl: string | null;
  proyectoId?: string;
  manualId?: string;
}

export const hoyBogota = () =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "America/Bogota" }).format(new Date());
const diaBogota = (iso?: string | null) =>
  iso ? new Intl.DateTimeFormat("en-CA", { timeZone: "America/Bogota" }).format(new Date(iso)) : null;
const dia = (v?: string | null) => (v ? v.slice(0, 10) : "");
export const sumarDias = (d: string, n: number) => {
  const x = new Date(`${d}T12:00:00Z`);
  x.setUTCDate(x.getUTCDate() + n);
  return x.toISOString().slice(0, 10);
};
export const diasEntre = (a: string, b: string) =>
  Math.round((new Date(`${b}T12:00:00Z`).getTime() - new Date(`${a}T12:00:00Z`).getTime()) / 86_400_000);

const norm = (t: string) =>
  (t || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, " ").trim();

export function comercialDe(p: Project): string | null {
  const visual = colorVisualDeEvento(p);
  if (!visual) return null;
  return (
    COLORES_DE_COMERCIAL.find((c) => c.valor.toLowerCase() === visual.color.toLowerCase())?.comercial ?? null
  );
}

/** Ejecuciones: el ultimo dia del evento. */
const finEvento = (p: Project) => dia(p.fechaEjecucionFin) || dia(p.fechaEjecucionInicio);
const inicioEvento = (p: Project) => dia(p.fechaEjecucionInicio);
const montaje = (p: Project) => dia(p.fechaMontajeInicio) || inicioEvento(p);

/** El momento en que se creo una linea de personal: va en el id ("p1764803039544"). */
const cuandoPersonal = (id: string) => {
  const m = /^p(\d{13})/.exec(id || "");
  return m ? diaBogota(new Date(Number(m[1])).toISOString()) : null;
};

export function tareasAutomaticas(
  proyectos: Project[],
  personas: Persona[],
  hoy = hoyBogota()
): Tarea[] {
  const porCorreo = new Map(personas.filter((p) => p.correo).map((p) => [p.correo!.toLowerCase(), p]));
  const porNombre = new Map(personas.map((p) => [norm(p.nombre), p]));
  const persona = (correoONombre: string): Persona => {
    const c = correoONombre.toLowerCase();
    return (
      porCorreo.get(c) ||
      porNombre.get(norm(correoONombre)) || { clave: norm(correoONombre) || "sin-responsable", nombre: correoONombre || "Sin responsable" }
    );
  };
  // El comercial se reconoce por el nombre del color ("Abraham") y su correo empieza asi.
  const personaComercial = (comercial: string): Persona =>
    personas.find((p) => p.correo?.toLowerCase().startsWith(comercial.toLowerCase() + ".")) || persona(comercial);

  const tareas: Tarea[] = [];
  let fechaActual = "";
  const add = (t: Omit<Tarea, "responsable" | "responsableNombre" | "fecha">, quien: Persona) =>
    tareas.push({ ...t, fecha: fechaActual, responsable: quien.clave, responsableNombre: quien.nombre });

  for (const p of proyectos) {
    if (p.isDeleted) continue;
    const ini = inicioEvento(p);
    const fin = finEvento(p);
    if (!ini) continue;
    fechaActual = ini;
    const evento = `${p.evento || "Sin nombre"}${p.cliente ? " · " + p.cliente : ""}`;
    const productores = listaDeProductores(p.productor);

    // 1. Productor: cargar costos (desde que arranca el evento; plazo 3 dias despues de terminar)
    if (ini >= MEDIR_DESDE.costos && ini <= hoy) {
      const hecha = costosResueltos(p.costos);
      const fechas = (p.costos || []).map((c) => diaBogota(c.creadoEn)).filter(Boolean) as string[];
      const hechaEl = hecha && fechas.length ? fechas.sort()[0] : null;
      const quienes = productores.length ? productores.map(persona) : [persona("")];
      for (const q of quienes) {
        add(
          {
            id: `costos-${p.id}-${q.clave}`,
            tipo: "costos",
            titulo: NOMBRE_TAREA.costos,
            detalle: evento,
            limite: sumarDias(fin, PLAZOS.costosDiasDespuesDelEvento),
            hecha,
            hechaEl,
            proyectoId: p.id,
          },
          q
        );
      }
    }

    // 2. Productor: asignar personal antes del montaje
    if (ini >= MEDIR_DESDE.personal && productores.length) {
      const nomina = (p.personal || []).filter((x) => x.tipoPersonal === "BBM");
      const hecha = nomina.length > 0;
      const fechas = nomina.map((x) => cuandoPersonal(x.id)).filter(Boolean) as string[];
      const limite = montaje(p);
      // Solo cuenta si ya esta hecha o si ya deberia estarlo (falta una semana o menos).
      if (hecha || sumarDias(limite, -7) <= hoy) {
        for (const q of productores.map(persona)) {
          add(
            {
              id: `personal-${p.id}-${q.clave}`,
              tipo: "personal",
              titulo: NOMBRE_TAREA.personal,
              detalle: evento,
              limite,
              hecha,
              hechaEl: hecha && fechas.length ? fechas.sort()[0] : null,
              proyectoId: p.id,
            },
            q
          );
        }
      }
    }

    // 3. Administrativo: subir la factura (5 dias despues de terminado)
    if (ini >= MEDIR_DESDE.factura && fin < hoy && p.estadoFacturacion !== "no_se_factura") {
      add(
        {
          id: `factura-${p.id}`,
          tipo: "factura",
          titulo: NOMBRE_TAREA.factura,
          detalle: evento,
          limite: sumarDias(fin, PLAZOS.facturaDiasDespuesDelEvento),
          hecha: Boolean(p.factura?.archivo),
          hechaEl: diaBogota(p.factura?.registradaEn),
          proyectoId: p.id,
        },
        persona(RESPONSABLE_FACTURAS)
      );
    }

    // 4. AUX BBM: centro de costos antes del montaje
    if (ini >= MEDIR_DESDE.centro_costos) {
      const limite = montaje(p);
      const hecha = Boolean((p.centroCostos || "").trim());
      if (hecha || sumarDias(limite, -7) <= hoy) {
        add(
          {
            id: `cc-${p.id}`,
            tipo: "centro_costos",
            titulo: NOMBRE_TAREA.centro_costos,
            detalle: evento,
            limite,
            hecha,
            hechaEl: null,
            proyectoId: p.id,
          },
          persona(RESPONSABLE_COSTOS)
        );
      }
    }

    // 5. AUX BBM: verificar y cerrar costos (5 dias despues de cargados)
    if (ini >= MEDIR_DESDE.verificar_costos && costosResueltos(p.costos)) {
      const fechas = (p.costos || []).map((c) => diaBogota(c.creadoEn)).filter(Boolean) as string[];
      const cargados = fechas.length ? fechas.sort()[fechas.length - 1] : fin;
      add(
        {
          id: `verificar-${p.id}`,
          tipo: "verificar_costos",
          titulo: NOMBRE_TAREA.verificar_costos,
          detalle: `${evento} · ${lineasReales(p.costos).length} línea(s)`,
          limite: sumarDias(cargados, PLAZOS.verificarDiasDespuesDeCargados),
          hecha: Boolean(p.costosVerificacion?.en),
          hechaEl: diaBogota(p.costosVerificacion?.en),
          proyectoId: p.id,
        },
        persona(RESPONSABLE_COSTOS)
      );
    }

    // 6. Director de cuenta (comercial del evento): asignar el productor antes
    //    del montaje. Asignar el PERSONAL ya le toca al productor (regla 2).
    const comercial = comercialDe(p);
    if (comercial && ini >= MEDIR_DESDE.productor) {
      const limite = montaje(p);
      const hecha = productores.length > 0;
      if (hecha || sumarDias(limite, -7) <= hoy) {
        add(
          {
            id: `productor-${p.id}`,
            tipo: "productor",
            titulo: NOMBRE_TAREA.productor,
            detalle: evento,
            limite,
            hecha,
            hechaEl: null,
            proyectoId: p.id,
          },
          personaComercial(comercial)
        );
      }
    }

    // 7. Comercial: valor de la cotizacion antes del montaje
    if (comercial && ini >= MEDIR_DESDE.valor_cotizacion) {
      const limite = montaje(p);
      const hecha = montosDelEvento(p).total > 0;
      if (hecha || limite <= hoy) {
        add(
          {
            id: `valor-${p.id}`,
            tipo: "valor_cotizacion",
            titulo: NOMBRE_TAREA.valor_cotizacion,
            detalle: evento,
            limite,
            hecha,
            hechaEl: null,
            proyectoId: p.id,
          },
          personaComercial(comercial)
        );
      }
    }
  }
  return tareas;
}

export interface Resumen {
  total: number;
  hechas: number;
  pendientes: number;
  vencidas: number;
  medibles: number; // hechas con fecha conocida y limite
  aTiempo: number;
  demoraPromedio: number | null; // dias de retraso promedio de las hechas tarde
}

export const vencida = (t: Tarea, hoy = hoyBogota()) => !t.hecha && !!t.limite && t.limite < hoy;
export const aTiempo = (t: Tarea) => t.hecha && !!t.hechaEl && !!t.limite && t.hechaEl <= t.limite;

export function resumir(tareas: Tarea[], hoy = hoyBogota()): Resumen {
  const hechas = tareas.filter((t) => t.hecha);
  const medibles = hechas.filter((t) => t.hechaEl && t.limite);
  const tarde = medibles.filter((t) => t.hechaEl! > t.limite!);
  return {
    total: tareas.length,
    hechas: hechas.length,
    pendientes: tareas.length - hechas.length,
    vencidas: tareas.filter((t) => vencida(t, hoy)).length,
    medibles: medibles.length,
    aTiempo: medibles.length - tarde.length,
    demoraPromedio: tarde.length
      ? Math.round((tarde.reduce((s, t) => s + diasEntre(t.limite!, t.hechaEl!), 0) / tarde.length) * 10) / 10
      : null,
  };
}

/** Que le toca a cada quien, en palabras, para mostrarlo en su ficha. */
export function responsabilidadesDe(p: Persona, tareas: Tarea[]): string[] {
  const tipos = new Set(tareas.filter((t) => t.responsable === p.clave).map((t) => t.tipo));
  const out: string[] = [];
  if (tipos.has("costos") || tipos.has("personal"))
    out.push(
      `Como productor: cargar los costos de su evento a más tardar ${PLAZOS.costosDiasDespuesDelEvento} días después de terminado, y asignar el personal antes del montaje.`
    );
  if (tipos.has("factura") || p.correo === RESPONSABLE_FACTURAS)
    out.push(`Subir la factura de cada evento ejecutado (máximo ${PLAZOS.facturaDiasDespuesDelEvento} días después) o marcarlo "No se factura".`);
  if (tipos.has("centro_costos") || tipos.has("verificar_costos") || p.correo === RESPONSABLE_COSTOS) {
    out.push("Subir el centro de costos de cada evento antes del montaje.");
    out.push(`Verificar línea por línea y cerrar los costos (máximo ${PLAZOS.verificarDiasDespuesDeCargados} días después de cargados).`);
  }
  if (tipos.has("productor") || tipos.has("valor_cotizacion"))
    out.push("Como director de cuenta: asignar el productor de sus eventos y cargar el valor de la cotización antes del montaje.");
  if (tipos.has("manual")) out.push("Las tareas que le asignes desde aquí.");
  return out;
}

// ---- Ventas y metas ---------------------------------------------------------

export interface AvanceMeta {
  comercial: string;
  meta: number;
  /** Todo lo del mes que ya esta en el planner (incluye eventos que faltan). */
  vendido: number;
  /** Solo lo ejecutado hasta hoy: es lo que se usa para los promedios. */
  ejecutadoAFecha: number;
  eventos: number;
  diasMes: number;
  diasTranscurridos: number;
  promedioDiario: number;
  promedioSemanal: number;
  proyeccion: number;
  necesarioPorDia: number | null;
  porSemana: { semana: string; venta: number }[];
}

/**
 * Ventas del mes de un comercial (venta sin IVA, por fecha de ejecucion, la
 * misma regla del dashboard) contra su meta.
 * Promedio diario = lo ejecutado hasta hoy / dias transcurridos del mes
 * (todos los dias, no solo habiles). Promedio semanal = promedio diario x 7.
 * Proyeccion = promedio diario x dias del mes. "Vendido" incluye ademas los
 * eventos del mes que todavia no se ejecutan.
 */
export function avanceDeMeta(
  proyectos: Project[],
  comercial: string,
  meta: number,
  mes: string, // YYYY-MM
  hoy = hoyBogota()
): AvanceMeta {
  const [y, m] = mes.split("-").map(Number);
  const diasMes = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const primero = `${mes}-01`;
  const ultimo = `${mes}-${String(diasMes).padStart(2, "0")}`;
  const diasTranscurridos =
    hoy < primero ? 0 : hoy > ultimo ? diasMes : diasEntre(primero, hoy) + 1;

  const delMes = proyectos.filter(
    (p) => !p.isDeleted && comercialDe(p) === comercial && inicioEvento(p) >= primero && inicioEvento(p) <= ultimo
  );
  const vendido = delMes.reduce((s, p) => s + montosDelEvento(p).base, 0);
  const ejecutadoAFecha = delMes
    .filter((p) => inicioEvento(p) <= hoy)
    .reduce((s, p) => s + montosDelEvento(p).base, 0);
  const promedioDiario = diasTranscurridos ? ejecutadoAFecha / diasTranscurridos : 0;

  const porSemana: { semana: string; venta: number }[] = [];
  for (let d = 1; d <= diasMes; d += 7) {
    const h = Math.min(d + 6, diasMes);
    const a = `${mes}-${String(d).padStart(2, "0")}`;
    const b = `${mes}-${String(h).padStart(2, "0")}`;
    const venta = delMes
      .filter((p) => inicioEvento(p) >= a && inicioEvento(p) <= b)
      .reduce((s2, p) => s2 + montosDelEvento(p).base, 0);
    porSemana.push({ semana: `${d}–${h}`, venta });
  }
  const restantes = diasMes - diasTranscurridos;
  return {
    comercial,
    meta,
    vendido,
    ejecutadoAFecha,
    eventos: delMes.length,
    diasMes,
    diasTranscurridos,
    promedioDiario,
    promedioSemanal: promedioDiario * 7,
    proyeccion: promedioDiario * diasMes,
    necesarioPorDia: restantes > 0 ? Math.max(0, (meta - ejecutadoAFecha) / restantes) : null,
    porSemana,
  };
}
