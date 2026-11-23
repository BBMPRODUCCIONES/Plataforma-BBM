/**
 * ZIP minimo, sin compresion ("store").
 *
 * Para empacar el informe de ventas: un Excel y los PDF de las facturas. Los
 * PDF ya vienen comprimidos, asi que comprimir otra vez no ahorra casi nada y
 * nos evita agregar una dependencia solo para esto.
 */

export interface ArchivoZip {
  /** Ruta dentro del ZIP, con "/" para carpetas. */
  nombre: string;
  datos: Uint8Array;
}

const TABLA_CRC = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(datos: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < datos.length; i++) c = TABLA_CRC[(c ^ datos[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

/** Fecha y hora en el formato de MS-DOS que usa el ZIP. */
function fechaDos(d: Date) {
  const hora = (d.getHours() << 11) | (d.getMinutes() << 5) | Math.floor(d.getSeconds() / 2);
  const fecha = ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate();
  return { hora, fecha };
}

export function crearZip(archivos: ArchivoZip[]): Blob {
  const codificador = new TextEncoder();
  const { hora, fecha } = fechaDos(new Date());
  const partes: BlobPart[] = [];
  const central: Uint8Array[] = [];
  let desplazamiento = 0;

  for (const a of archivos) {
    const nombre = codificador.encode(a.nombre);
    const crc = crc32(a.datos);
    const tam = a.datos.length;

    // Encabezado local. Bit 11 de las banderas = nombre en UTF-8 (tildes, ñ).
    const local = new Uint8Array(30 + nombre.length);
    const vl = new DataView(local.buffer);
    vl.setUint32(0, 0x04034b50, true);
    vl.setUint16(4, 20, true);
    vl.setUint16(6, 0x0800, true);
    vl.setUint16(8, 0, true);
    vl.setUint16(10, hora, true);
    vl.setUint16(12, fecha, true);
    vl.setUint32(14, crc, true);
    vl.setUint32(18, tam, true);
    vl.setUint32(22, tam, true);
    vl.setUint16(26, nombre.length, true);
    vl.setUint16(28, 0, true);
    local.set(nombre, 30);

    const cab = new Uint8Array(46 + nombre.length);
    const vc = new DataView(cab.buffer);
    vc.setUint32(0, 0x02014b50, true);
    vc.setUint16(4, 20, true);
    vc.setUint16(6, 20, true);
    vc.setUint16(8, 0x0800, true);
    vc.setUint16(10, 0, true);
    vc.setUint16(12, hora, true);
    vc.setUint16(14, fecha, true);
    vc.setUint32(16, crc, true);
    vc.setUint32(20, tam, true);
    vc.setUint32(24, tam, true);
    vc.setUint16(28, nombre.length, true);
    vc.setUint32(42, desplazamiento, true);
    cab.set(nombre, 46);

    partes.push(local, a.datos);
    central.push(cab);
    desplazamiento += local.length + tam;
  }

  const tamCentral = central.reduce((s, c) => s + c.length, 0);
  const fin = new Uint8Array(22);
  const vf = new DataView(fin.buffer);
  vf.setUint32(0, 0x06054b50, true);
  vf.setUint16(8, archivos.length, true);
  vf.setUint16(10, archivos.length, true);
  vf.setUint32(12, tamCentral, true);
  vf.setUint32(16, desplazamiento, true);

  return new Blob([...partes, ...central, fin], { type: "application/zip" });
}
