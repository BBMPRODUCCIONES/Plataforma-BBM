

## Plan: Ventana de deshacer de 2 horas + Reset de solicitudes

### Problema
Un toast de 6 segundos es insuficiente. Se necesita una ventana de 2 horas para deshacer cambios de estado. Un toast no puede permanecer visible 2 horas, por lo que se necesita un mecanismo persistente.

### Diseño propuesto

**1. Mecanismo de deshacer persistente (2 horas)**

En lugar de un toast efímero, se implementará:

- **Tabla en base de datos** `aprobacion_undo_log` para registrar cada cambio de estado con: `id`, `project_id`, `item_id`, `source` (cajaMenor/gastoMenor), `previous_estado`, `new_estado`, `previous_revisado_por`, `changed_by`, `changed_at`, `expires_at` (changed_at + 2h), `undone` (boolean).

- **UI persistente**: Un botón "Deshacer" visible en cada fila que haya sido modificada en las últimas 2 horas (por el usuario actual). El botón desaparece automáticamente al vencer el plazo. Se mostrará un badge con el tiempo restante junto al botón.

- **Toast inmediato**: Se mantiene un toast breve confirmando el cambio, pero ahora solo informativo (sin acción de deshacer en el toast).

**2. Reset global de solicitudes a Pendiente**

Migración SQL para:
- Actualizar `gastos_menores` → `estado = 'Pendiente'`, limpiar campos de aprobación
- Actualizar `projects.caja_menor` y `projects.legalizacion` (JSONB) → estados a `Pendiente`/`Revisando`

### Cambios técnicos

| Archivo/Recurso | Cambio |
|---|---|
| **Nueva migración SQL** | Crear tabla `aprobacion_undo_log` + reset masivo de estados |
| **AprobacionesPendientes.tsx** | Reemplazar toast-undo por consulta al undo_log; mostrar botón "Deshacer" en filas con cambios recientes (<2h); implementar lógica de reversión al hacer clic |
| **RLS en undo_log** | INSERT para authenticated, SELECT/UPDATE solo para el propio `changed_by`, DELETE solo admin |

### Flujo de usuario

1. Admin cambia estado → se guarda registro en `aprobacion_undo_log` con `expires_at = now() + 2h`
2. Toast informativo aparece brevemente
3. En la tabla, la fila muestra un botón "Deshacer (1h 45m)" mientras esté dentro del plazo
4. Al hacer clic en "Deshacer", se revierte el estado y se marca `undone = true`
5. Pasadas las 2 horas, el botón desaparece automáticamente

