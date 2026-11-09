import { CostoEvento } from "@/types";

/**
 * "Este evento no tuvo costos de terceros".
 *
 * Hace falta distinguir dos cosas que hoy se ven iguales: un evento al que
 * nadie le ha cargado los costos todavia, y uno que de verdad no tuvo ninguno
 * (se hizo con equipo propio y personal de nomina, o lo cubrio otro
 * contrato). Sin esa distincion, el segundo se queda en rojo para siempre y
 * la unica salida es inventarse una linea de un peso, que es justo lo que
 * estaba pasando.
 *
 * Se guarda como una linea marcada dentro del mismo campo `costos`, y no como
 * una columna nueva, a proposito: `costos` es jsonb y acepta la marca sin
 * tocar el esquema. Una columna obligaria a correr la migracion ANTES de
 * subir el codigo, y entre lo uno y lo otro guardar costos quedaria roto para
 * todos. Asi el cambio viaja completo.
 *
 * La marca nunca se muestra como una linea ni suma al total: para eso estan
 * `lineasReales` y `totalDeCostos`.
 */
export const TIPO_SIN_TERCEROS = "sin_costos_terceros";

/** El evento esta marcado como "no tuvo costos de terceros"? */
export function marcadoSinTerceros(costos?: CostoEvento[] | null): boolean {
  return (costos || []).some((c) => c.tipo === (TIPO_SIN_TERCEROS as CostoEvento["tipo"]));
}

/** Las lineas de costo de verdad, sin la marca. */
export function lineasReales(costos?: CostoEvento[] | null): CostoEvento[] {
  return (costos || []).filter((c) => c.tipo !== (TIPO_SIN_TERCEROS as CostoEvento["tipo"]));
}

export function totalDeCostos(costos?: CostoEvento[] | null): number {
  return lineasReales(costos).reduce((suma, c) => suma + (Number(c.valor) || 0), 0);
}

/**
 * El evento ya esta resuelto en cuanto a costos?
 *
 * Lo esta si tiene al menos una linea real, o si alguien declaro que no tuvo
 * costos de terceros. Es la pregunta que decide la alerta roja.
 */
export function costosResueltos(costos?: CostoEvento[] | null): boolean {
  return lineasReales(costos).length > 0 || marcadoSinTerceros(costos);
}

/** Construye la linea de marca. Quien la puso y cuando, para poder revisarlo. */
export function lineaDeMarca(correo?: string | null): CostoEvento {
  return {
    id: `sin-terceros-${Date.now()}`,
    tipo: TIPO_SIN_TERCEROS as CostoEvento["tipo"],
    concepto: "El evento no tuvo costos de terceros",
    beneficiario: "",
    valor: 0,
    creadoEn: new Date().toISOString(),
    creadoPorEmail: correo || undefined,
  };
}

/**
 * Huella de los costos: cambia si cambia cualquier linea (tipo, valor,
 * concepto, beneficiario) o la marca de "sin costos de terceros". Sirve para
 * saber si lo verificado sigue siendo lo que hay.
 */
export function huellaDeCostos(costos?: CostoEvento[] | null): string {
  const filas = (costos || [])
    .map((c) =>
      [c.id, c.tipo, Number(c.valor) || 0, (c.concepto || "").trim(), (c.beneficiario || "").trim()].join("|")
    )
    .sort();
  // djb2: corta y estable; no es seguridad, es detectar cambios.
  let h = 5381;
  const txt = filas.join("\n");
  for (let i = 0; i < txt.length; i++) h = ((h << 5) + h + txt.charCodeAt(i)) | 0;
  return `${filas.length}-${(h >>> 0).toString(36)}`;
}

/** Huella de UNA linea: tipo, valor, concepto y a quien se le pago. */
export function huellaDeLinea(c: CostoEvento): string {
  const txt = [c.tipo, Number(c.valor) || 0, (c.concepto || "").trim(), (c.beneficiario || "").trim()].join("|");
  let h = 5381;
  for (let i = 0; i < txt.length; i++) h = ((h << 5) + h + txt.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}

/** La linea tiene check y sigue siendo la misma que se verifico. */
export function lineaVerificada(c: CostoEvento): boolean {
  return Boolean(c.verificacion?.en) && c.verificacion?.huella === huellaDeLinea(c);
}

/** Tuvo check pero la cambiaron despues. */
export function lineaCambioTrasVerificar(c: CostoEvento): boolean {
  return Boolean(c.verificacion?.en) && c.verificacion?.huella !== huellaDeLinea(c);
}
