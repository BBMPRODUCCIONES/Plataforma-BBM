import { ColumnConfig } from "@/components/ColumnManagerDialog";

/**
 * Deja una columna de primera y visible, pase lo que pase.
 *
 * La estructura de columnas guardada en panel_column_configs manda sobre los
 * valores por defecto del codigo, y useGlobalColumns solo agrega las columnas
 * que faltan: a una que ya existe no le cambia ni el orden ni la visibilidad.
 * Asi que mover la columna en los valores por defecto no sirve de nada, y hay
 * que anclarla aqui.
 *
 * Si la columna no existe en la lista, se devuelve la lista tal cual: esta
 * funcion coloca, no inventa.
 */
export function anclarPrimero(columnas: ColumnConfig[], clave: string): ColumnConfig[] {
  const i = columnas.findIndex((c) => c.key === clave);
  if (i === -1) return columnas;
  const anclada = { ...columnas[i], visible: true };
  const resto = columnas.filter((_, n) => n !== i);
  return [anclada, ...resto].map((c, n) => ({ ...c, order: n }));
}
