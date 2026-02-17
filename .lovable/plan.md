
## Plan: Eliminar columnas "Estado Solicitud" y "Estado Legaliz." de Solicitud de Anticipos

Se eliminarán las dos columnas extra que se agregaron en la tabla de **Solicitud de Anticipos**, ya que el estado ya se muestra en el encabezado de la sección.

### Cambios en `src/pages/PanelOperaciones.tsx`

1. **Eliminar encabezados de columna** (lineas 3129-3130): Quitar los `<th>` de "Estado Solicitud" y "Estado Legaliz."

2. **Eliminar celdas de datos** (lineas 3326-3357): Quitar los dos `<td>` que renderizan los badges de estado de solicitud y legalización en cada fila.

### Resultado
La tabla de Solicitud de Anticipos quedará con las columnas: Concepto, Categoría, Valor anticipo, Imagen, Valor legalización, Diferencia y la columna de acciones. El estado general seguirá visible en el encabezado de la sección.
