

# Agregar numeracion secuencial "Solicitud de Anticipo No." por proyecto

## Resumen

Cada proyecto que tenga solicitud de presupuesto recibira un numero unico y secuencial de "Solicitud de Anticipo" (ej: 1, 2, 3...). Este numero se asigna una sola vez al proyecto (no cada vez que se exporta) y se guarda en la base de datos para que sea consistente sin importar quien exporte o cuantas veces lo haga.

## Como funcionara

- Cuando un usuario exporta el PDF o Excel de "Solicitud de Presupuesto" por primera vez para un proyecto, el sistema le asignara automaticamente el siguiente numero disponible.
- Si ese proyecto ya tiene un numero asignado (porque ya se exporto antes), se reutiliza el mismo numero.
- El numero es global: si hay 30 proyectos con solicitud de presupuesto, los numeros van del 1 al 30 en orden de primera exportacion.

## Seccion tecnica

### 1. Nueva columna en la tabla `projects`

Agregar `solicitud_anticipo_num` (tipo integer, nullable, sin default) a la tabla `projects`. Solo se llena cuando se genera la primera exportacion de presupuesto para ese proyecto.

### 2. Nueva funcion de base de datos

Crear una funcion SQL `assign_solicitud_anticipo_num(project_id uuid)` que:
- Si el proyecto ya tiene numero, lo retorna sin cambios
- Si no, calcula `MAX(solicitud_anticipo_num) + 1` de todos los proyectos y lo asigna
- Usa bloqueo (`FOR UPDATE`) para evitar numeros duplicados en concurrencia

### 3. Cambios en `src/utils/pdfGenerator.ts`

- Modificar `printSolicitudPresupuesto` y `exportSolicitudToExcel` para recibir el numero de solicitud como parametro
- Incluir el numero en el formato corporativo: "SOLICITUD DE ANTICIPO No. **XX**"

### 4. Cambios en `src/pages/PanelOperaciones.tsx`

- Antes de llamar a las funciones de exportacion, verificar si el proyecto ya tiene `solicitud_anticipo_num`
- Si no lo tiene, llamar a la funcion RPC `assign_solicitud_anticipo_num` para obtener y guardar el numero
- Pasar el numero obtenido a las funciones de exportacion

### Archivos a modificar

| Archivo | Cambio |
|---------|--------|
| Migracion SQL | Agregar columna `solicitud_anticipo_num` a `projects` y crear funcion RPC `assign_solicitud_anticipo_num` |
| `src/utils/pdfGenerator.ts` | Recibir y mostrar el numero de solicitud en PDF y Excel |
| `src/pages/PanelOperaciones.tsx` | Logica para asignar/obtener el numero antes de exportar |

