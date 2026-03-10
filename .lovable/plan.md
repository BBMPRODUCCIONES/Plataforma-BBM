

## Plan: Sincronización Automática con Google Calendar + Mejora Visual

### Problema actual
1. La sincronización es **manual** — el usuario debe seleccionar proyectos y hacer clic.
2. Cada sincronización **crea eventos duplicados** porque no se rastrea qué eventos ya fueron creados en Google Calendar.
3. La descripción de los eventos es básica (solo cliente, ubicación, notas).

### Solución

#### 1. Nueva tabla `google_calendar_events` para rastrear eventos sincronizados
Almacena la relación entre proyecto ↔ evento de Google Calendar para evitar duplicados y permitir actualizaciones.

```text
google_calendar_events
├── id (uuid PK)
├── user_id (uuid, ref auth.users)
├── project_id (uuid, ref projects)
├── event_type ('montaje' | 'ejecucion')
├── google_event_id (text) ← ID del evento en Google
├── last_synced_at (timestamptz)
├── project_hash (text) ← hash de los datos para detectar cambios
└── created_at (timestamptz)
```

#### 2. Nueva edge function `google-calendar-auto-sync`
- Se ejecuta **sin autenticación de usuario** (invocada por cron).
- Lee **todos los usuarios conectados** desde `google_calendar_tokens`.
- Para cada usuario, lee **todos los proyectos** con fechas desde la tabla `projects`.
- Compara con `google_calendar_events` para detectar:
  - **Nuevos**: crear evento en Google Calendar.
  - **Modificados**: actualizar evento existente (PATCH).
  - **Sin cambios**: omitir.
- Usa un hash de los campos relevantes (fechas, horas, cliente, ubicación, evento) para detectar cambios.

#### 3. Cron job cada minuto
- Habilitar extensiones `pg_cron` y `pg_net`.
- Crear un cron job que invoque `google-calendar-auto-sync` cada minuto vía `net.http_post`.

#### 4. Mejora visual de los eventos en Google Calendar
- **Descripción enriquecida** con formato estructurado:
  - 📋 Evento, 👤 Cliente, 📍 Ubicación, 🕐 Horarios detallados, 📝 Notas
  - Estado del proyecto, personal asignado, productor, jefe de operaciones
- **Colores diferenciados**: Montaje (gris/`colorId: 8`), Ejecución (azul/`colorId: 9`) — ya implementado.
- Google Calendar **no soporta HTML en descripciones**, pero sí texto con saltos de línea y emojis que se visualizan bien.

#### 5. Actualización de la UI
- Mostrar indicador de "Sincronización Automática Activa" en la página de Google Calendar.
- Mantener la opción de sincronización manual como complemento.
- Mostrar última fecha de sincronización automática.

### Cambios técnicos

| Archivo | Cambio |
|---------|--------|
| **Migration SQL** | Crear tabla `google_calendar_events`, habilitar `pg_cron` y `pg_net` |
| **SQL (insert, no migration)** | Crear cron job cada minuto |
| `supabase/functions/google-calendar-auto-sync/index.ts` | Nueva función: lee proyectos del DB, sincroniza para todos los usuarios conectados, usa PATCH para updates |
| `supabase/functions/google-calendar-sync/index.ts` | Actualizar para registrar eventos en `google_calendar_events` y usar update en vez de create cuando ya existe |
| `supabase/config.toml` | Agregar config para `google-calendar-auto-sync` con `verify_jwt = false` |
| `src/pages/GoogleCalendar.tsx` | Mostrar estado de auto-sync, última sincronización, y mantener sync manual |

### Sobre la pregunta visual
Google Calendar tiene limitaciones: las descripciones son solo texto plano (no HTML, no imágenes). Lo que **sí** se puede mejorar:
- Emojis y formato con saltos de línea en la descripción
- Colores por tipo de evento (ya implementado)
- Título más descriptivo con prefijos claros `[MONTAJE]` / `[EJECUCIÓN]`
- Incluir más datos del proyecto (personal, productor, estado)

No es posible subir imágenes o diseños personalizados al evento de Google Calendar desde la API.

