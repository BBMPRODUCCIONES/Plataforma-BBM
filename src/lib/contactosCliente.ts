import { Project } from "@/types";

/**
 * Contactos conocidos de un cliente, sacados de sus eventos anteriores.
 *
 * Sirve para el relleno automatico: al escoger el cliente de un evento, se
 * propone (o se pone) la persona y el celular que ya se usaron con ese
 * cliente. Primero el mas reciente.
 */
export interface ContactoConocido {
  nombre: string;
  telefono: string;
  /** Cuantos eventos usaron este contacto. */
  veces: number;
  /** Fecha (ISO) del evento mas reciente que lo uso. */
  ultimo: string;
}

const clave = (t?: string | null) =>
  (t || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]/g, "");

const digitos = (t?: string | null) => (t || "").replace(/[^\d]/g, "");

export function contactosDelCliente(
  proyectos: Project[],
  cliente?: string | null,
  excluirId?: string
): ContactoConocido[] {
  const c = clave(cliente);
  if (!c) return [];
  const mapa = new Map<string, ContactoConocido>();
  for (const p of proyectos) {
    if (p.isDeleted || p.id === excluirId || clave(p.cliente) !== c) continue;
    const tel = digitos(p.contactoTelefono);
    if (tel.length < 7) continue;
    const fecha = p.fechaEjecucionInicio || p.createdAt || "";
    const actual = mapa.get(tel);
    const nombre = (p.contactoNombre || "").trim();
    if (!actual) {
      mapa.set(tel, { nombre, telefono: (p.contactoTelefono || "").trim(), veces: 1, ultimo: fecha });
    } else {
      actual.veces += 1;
      if (fecha > actual.ultimo) {
        actual.ultimo = fecha;
        if (nombre) actual.nombre = nombre;
      } else if (!actual.nombre && nombre) {
        actual.nombre = nombre;
      }
    }
  }
  return [...mapa.values()].sort((a, b) => b.ultimo.localeCompare(a.ultimo));
}

/** El contacto que se pone solo: el mas reciente del cliente. */
export const contactoSugerido = (proyectos: Project[], cliente?: string | null, excluirId?: string) =>
  contactosDelCliente(proyectos, cliente, excluirId)[0] ?? null;

/**
 * Cambios para un evento al que le cambiaron el cliente: si no tiene
 * telefono, se le pone el contacto conocido del cliente. Si ya tiene uno, no
 * se toca.
 */
export function rellenoAlCambiarCliente(
  proyectos: Project[],
  proyecto: Project,
  cliente: string
): Partial<Project> {
  const cambios: Partial<Project> = { cliente };
  if (digitos(proyecto.contactoTelefono).length >= 7) return cambios;
  const s = contactoSugerido(proyectos, cliente, proyecto.id);
  if (s) {
    cambios.contactoTelefono = s.telefono;
    if (!(proyecto.contactoNombre || "").trim()) cambios.contactoNombre = s.nombre;
  }
  return cambios;
}
