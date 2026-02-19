

## Plan: Renombrar sección "Gastos Menores" a "Caja Menor" en Panel de Operaciones

### Contexto
Actualmente, en el dialog de "Gastos" del Panel de Operaciones ya existe una sección llamada "GASTOS MENORES" que muestra los registros del Reporte de Caja Menor filtrados por el centro de costos del evento, en modo solo lectura. Esta sección solo aparece cuando hay registros.

### Cambios a realizar

**Archivo: `src/pages/PanelOperaciones.tsx`**

1. **Renombrar la sección**: Cambiar el titulo de "GASTOS MENORES" a "CAJA MENOR"
2. **Mostrar siempre la sección**: Eliminar la condicion `gastosMenoresForProject.length > 0` para que la seccion siempre sea visible, mostrando un mensaje de "No hay registros" cuando este vacia
3. **Actualizar la descripcion**: Cambiar "Registros desde Reporte de Caja Menor (solo lectura)" a un texto acorde

### Detalles tecnicos

- Se modifica unicamente el bloque de JSX en las lineas ~3495-3552 del archivo `PanelOperaciones.tsx`
- No se requieren cambios en la base de datos ni en otros archivos
- La funcionalidad de solo lectura se mantiene exactamente igual
- La consulta de datos via `useGastosMenores(centroCostos)` ya existe y filtra correctamente por centro de costos del evento

