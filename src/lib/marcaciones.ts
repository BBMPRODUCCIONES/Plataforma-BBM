/**
 * Llegada y salida del personal (tabla marcaciones).
 *
 * Cada marca es una foto con la hora, las coordenadas y la direccion
 * estampadas abajo. Las horas trabajadas salen de emparejar cada llegada con
 * la salida siguiente de la misma persona.
 */

export type TipoMarca = "entrada" | "salida";

export interface Marcacion {
  id: string;
  user_id: string;
  nombre: string;
  correo: string;
  tipo: TipoMarca;
  marcada_en: string;
  lat: number | null;
  lng: number | null;
  precision_m: number | null;
  direccion: string;
  foto_path: string;
}

export interface Jornada {
  clave: string;
  userId: string;
  nombre: string;
  /** YYYY-MM-DD (Bogota) del dia de la llegada, o de la salida si no hubo llegada. */
  dia: string;
  entrada: Marcacion | null;
  salida: Marcacion | null;
  /** Horas entre llegada y salida; null si falta una de las dos. */
  horas: number | null;
}

export interface ResumenPersona {
  userId: string;
  nombre: string;
  correo: string;
  horas: number;
  dias: number;
  incompletas: number;
  jornadas: Jornada[];
}

const ZONA = "America/Bogota";

/** Una jornada no dura mas de esto: si pasa, la llegada quedo sin salida. */
const MAX_HORAS_JORNADA = 20;

export const diaBogota = (iso: string) =>
  new Intl.DateTimeFormat("en-CA", { timeZone: ZONA }).format(new Date(iso));

export const horaBogota = (iso: string, conSegundos = false) =>
  new Intl.DateTimeFormat("es-CO", {
    timeZone: ZONA,
    hour: "numeric",
    minute: "2-digit",
    ...(conSegundos ? { second: "2-digit" } : {}),
    hour12: true,
  }).format(new Date(iso));

export const fechaLarga = (d: Date | string) =>
  new Intl.DateTimeFormat("es-CO", {
    timeZone: ZONA,
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(typeof d === "string" ? new Date(d) : d);

export const fechaCortaDia = (dia: string) =>
  new Date(`${dia}T12:00:00Z`).toLocaleDateString("es-CO", {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });

/** 7.5 -> "7 h 30 min" */
export const formatoHoras = (h: number | null) => {
  if (h == null) return "—";
  const min = Math.round(h * 60);
  const hh = Math.floor(min / 60);
  const mm = min % 60;
  return mm ? `${hh} h ${String(mm).padStart(2, "0")} min` : `${hh} h`;
};

export const mapaDe = (m: Pick<Marcacion, "lat" | "lng">) =>
  m.lat != null && m.lng != null ? `https://www.google.com/maps?q=${m.lat},${m.lng}` : null;

/**
 * Empareja llegadas y salidas de cada persona, en orden de hora.
 * - Llegada seguida de salida (en menos de 20 h): jornada completa.
 * - Llegada sin salida, o salida sin llegada: jornada incompleta (0 horas).
 */
export function jornadasDe(marcas: Marcacion[]): Jornada[] {
  const porPersona = new Map<string, Marcacion[]>();
  for (const m of marcas) {
    const l = porPersona.get(m.user_id) || [];
    l.push(m);
    porPersona.set(m.user_id, l);
  }
  const out: Jornada[] = [];
  for (const [userId, lista] of porPersona) {
    lista.sort((a, b) => a.marcada_en.localeCompare(b.marcada_en));
    let abierta: Marcacion | null = null;
    const nombre = lista[lista.length - 1].nombre || lista[0].correo;
    const cerrar = (entrada: Marcacion | null, salida: Marcacion | null) => {
      const horas =
        entrada && salida ? (new Date(salida.marcada_en).getTime() - new Date(entrada.marcada_en).getTime()) / 3_600_000 : null;
      out.push({
        clave: `${userId}-${(entrada || salida)!.id}`,
        userId,
        nombre,
        dia: diaBogota((entrada || salida)!.marcada_en),
        entrada,
        salida,
        horas,
      });
    };
    for (const m of lista) {
      if (m.tipo === "entrada") {
        if (abierta) cerrar(abierta, null);
        abierta = m;
      } else if (abierta) {
        const h = (new Date(m.marcada_en).getTime() - new Date(abierta.marcada_en).getTime()) / 3_600_000;
        if (h <= MAX_HORAS_JORNADA) {
          cerrar(abierta, m);
        } else {
          cerrar(abierta, null);
          cerrar(null, m);
        }
        abierta = null;
      } else {
        cerrar(null, m);
      }
    }
    if (abierta) cerrar(abierta, null);
  }
  return out.sort((a, b) => b.dia.localeCompare(a.dia) || a.nombre.localeCompare(b.nombre));
}

export function resumenPorPersona(marcas: Marcacion[]): ResumenPersona[] {
  const jornadas = jornadasDe(marcas);
  const mapa = new Map<string, ResumenPersona>();
  for (const j of jornadas) {
    const r =
      mapa.get(j.userId) ||
      ({
        userId: j.userId,
        nombre: j.nombre,
        correo: (j.entrada || j.salida)!.correo,
        horas: 0,
        dias: 0,
        incompletas: 0,
        jornadas: [],
      } as ResumenPersona);
    r.jornadas.push(j);
    if (j.horas != null) r.horas += j.horas;
    else r.incompletas += 1;
    mapa.set(j.userId, r);
  }
  for (const r of mapa.values()) r.dias = new Set(r.jornadas.filter((j) => j.horas != null).map((j) => j.dia)).size;
  return [...mapa.values()].sort((a, b) => b.horas - a.horas);
}

/** Primer y ultimo dia (YYYY-MM-DD) del mes actual en Bogota. */
export function mesActualBogota(): { desde: string; hasta: string } {
  const hoy = new Intl.DateTimeFormat("en-CA", { timeZone: ZONA }).format(new Date());
  const [y, m] = hoy.split("-").map(Number);
  const ultimo = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return { desde: `${hoy.slice(0, 7)}-01`, hasta: `${hoy.slice(0, 7)}-${String(ultimo).padStart(2, "0")}` };
}

/** Limites en UTC de un rango de dias de Bogota (UTC-5, sin horario de verano). */
export const rangoUtc = (desde: string, hasta: string) => ({
  desde: new Date(`${desde}T00:00:00-05:00`).toISOString(),
  hasta: new Date(`${hasta}T23:59:59.999-05:00`).toISOString(),
});
