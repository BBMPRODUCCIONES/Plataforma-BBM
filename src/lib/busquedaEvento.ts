import { Project } from "@/types";

/**
 * Decide si un evento aparece al escribir en la casilla de buscar.
 *
 * Esta en un archivo aparte porque el Panel General y el Panel Operaciones
 * tenian la misma condicion copiada. Cuando se agrego el numero de factura
 * habia que acordarse de tocar los dos; ahora el campo se agrega una vez aca.
 *
 * El numero de factura se busca sin puntos ni guiones ni espacios: en la base
 * esta escrito de varias formas ("FV-1403", "fv1403", "FV 1403") porque venia
 * de texto libre, y quien busca escribe la que recuerda.
 */

/** Quita acentos y pasa a minusculas, para comparar sin tropezar con tildes. */
function normalizar(texto: string): string {
  return (texto || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

/** "FV-1403" -> "fv1403". Solo letras y numeros. */
function soloLetrasYNumeros(texto: string): string {
  return normalizar(texto).replace(/[^a-z0-9]/g, "");
}

export function coincideBusquedaDeEvento(proyecto: Project, termino: string): boolean {
  const t = normalizar(termino).trim();
  if (!t) return true;

  if (
    normalizar(proyecto.cliente).includes(t) ||
    normalizar(proyecto.evento).includes(t) ||
    normalizar(proyecto.centroCostos).includes(t)
  ) {
    return true;
  }

  // Numero de factura: se compara tambien sin separadores, asi "1403" y
  // "fv-1403" encuentran el evento guardado como "FV 1403".
  const factura = proyecto.numFactura || "";
  if (normalizar(factura).includes(t)) return true;

  const terminoPelado = soloLetrasYNumeros(termino);
  if (terminoPelado && soloLetrasYNumeros(factura).includes(terminoPelado)) return true;

  return false;
}
