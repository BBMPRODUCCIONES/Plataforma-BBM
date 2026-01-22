# Configuración y Reglas Técnicas

## Archivos de Configuración Críticos

### Archivos AUTO-GENERADOS (NO MODIFICAR)

| Archivo | Descripción |
|---------|-------------|
| `supabase/config.toml` | Configuración de Supabase |
| `src/integrations/supabase/client.ts` | Cliente de Supabase |
| `src/integrations/supabase/types.ts` | Tipos generados de BD |
| `.env` | Variables de entorno |

> ⚠️ **IMPORTANTE**: Estos archivos son actualizados automáticamente por Lovable Cloud. Modificarlos manualmente causará conflictos.

### Archivos configurables

| Archivo | Propósito |
|---------|-----------|
| `tailwind.config.ts` | Temas, colores, extensiones CSS |
| `vite.config.ts` | Plugins, alias, build config |
| `index.html` | Meta tags, scripts externos |
| `src/index.css` | Variables CSS globales, tokens |

## Gestión de Roles y Permisos

### Arquitectura de Seguridad

```
┌─────────────────────────────────────────────────────┐
│                    Frontend                          │
│  ┌─────────────────────────────────────────────┐    │
│  │ ProtectedRoute (verifica acceso a ruta)      │    │
│  │     ↓                                        │    │
│  │ useUserRole (hook de permisos)               │    │
│  │     ↓                                        │    │
│  │ AuthContext (estado de autenticación)        │    │
│  └─────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────┐
│                    Backend                           │
│  ┌─────────────────────────────────────────────┐    │
│  │ RLS Policies (Row Level Security)            │    │
│  │     ↓                                        │    │
│  │ has_role() function (verificación de rol)    │    │
│  │     ↓                                        │    │
│  │ user_roles table (fuente de verdad)          │    │
│  └─────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────┘
```

### Roles disponibles

| Rol | Código | Nivel de acceso |
|-----|--------|-----------------|
| Administrador | `administrador` | Acceso total |
| Operativo | `operativo` | Edición limitada |
| Visual | `visual` | Solo lectura |

### Paneles por defecto según rol

```typescript
const DEFAULT_PANELS = {
  administrador: ['ALL_PANELS'],
  operativo: ['general', 'operaciones', 'proveedores'],
  visual: ['general', 'operaciones', 'proveedores']
};
```

### Flags de permisos adicionales

| Flag | Tipo | Propósito |
|------|------|-----------|
| `puede_ver_feedback` | boolean | Acceso a sección feedback |
| `puede_editar_feedback` | boolean | Edición de feedback |

### Verificación de permisos en código

```typescript
// En componente React
const { isAdmin, canEdit, canAccessPanel, canViewFeedback } = useUserRole();

// Verificar acceso a panel
if (!canAccessPanel('reportes')) {
  return <AccessDenied />;
}

// Verificar permiso de edición
if (canEdit) {
  // Mostrar controles de edición
}

// Verificar permiso especial
if (canViewFeedback()) {
  // Mostrar sección de feedback
}
```

## Flags de Visualización

### Soft Delete

Los registros eliminados usan soft delete con `deleted_at`:

```typescript
// Filtrar registros activos
const { data } = await supabase
  .from('projects')
  .select('*')
  .is('deleted_at', null);  // Solo activos
```

### Estados que ocultan elementos

| Estado | Comportamiento |
|--------|----------------|
| `deleted_at IS NOT NULL` | Registro eliminado (oculto) |
| `is_active = false` | Usuario desactivado |
| `estado = 'cancelado'` | Proyecto cancelado (puede filtrarse) |

## Reglas que NO Deben Romperse

### 1. Seguridad de Roles

```
❌ PROHIBIDO: Almacenar roles en localStorage
❌ PROHIBIDO: Almacenar roles en tabla profiles
❌ PROHIBIDO: Verificar roles solo en frontend

✅ CORRECTO: Roles en tabla user_roles separada
✅ CORRECTO: Verificar con función has_role() en backend
✅ CORRECTO: RLS policies usando has_role()
```

### 2. Relación Usuario-Empleado

```
• Cada usuario DEBE tener un empleado vinculado por email
• El email es el identificador único de vinculación
• Al crear invitación, se crea/reactiva empleado automáticamente
```

### 3. Aislamiento de Datos

```
• Caja Menor es independiente de Personal e Inventario
• La numeración de recibos es por proyecto
• Los gastos tienen validación contextual separada
```

### 4. Archivos Inmutables

```
❌ NO MODIFICAR:
  - supabase/config.toml
  - src/integrations/supabase/client.ts
  - src/integrations/supabase/types.ts
  - .env
  - package.json (usar herramientas de Lovable)
```

### 5. Patrón de Permisos

```
• Usar flags granulares, NO crear nuevos roles
• Los flags se configuran a nivel rol (default) y usuario (override)
• Administradores siempre tienen bypass automático
```

## Configuración de Autenticación

### Supabase Auth Settings

```
✅ Auto-confirm email: HABILITADO
❌ Anonymous signups: DESHABILITADO
❌ Signup público: DESHABILITADO (solo por invitación)
```

### Flujo de invitación

```
1. Admin crea invitación → genera token único
2. Email enviado al invitado con link
3. Invitado accede a /crear-cuenta?token=xxx
4. Sistema valida token y crea cuenta
5. Se crea/reactiva empleado automáticamente
6. Se asigna rol y paneles según invitación
```

## Configuración de Storage

### Buckets configurados

| Bucket | Público | Max Size | Tipos permitidos |
|--------|---------|----------|------------------|
| `project-attachments` | No | 50MB | Todos |
| `supplier-cotizaciones` | No | 50MB | PDF, imágenes |
| `notes-images` | Sí | 10MB | Imágenes |

### Acceso a archivos privados

```typescript
// Obtener URL firmada (temporal)
const { data } = await supabase.functions.invoke('get-signed-url', {
  body: { bucket: 'project-attachments', path: 'ruta/archivo.pdf' }
});
// data.signedUrl válida por 1 hora
```

## Configuración de Notificaciones Push

### OneSignal

- **App ID**: Configurado en código
- **REST API Key**: En secrets de Edge Functions
- **Service Workers**: En `/public/`

### Flujo de notificación

```
1. Acción dispara notificación
2. Edge function send-push-notification
3. OneSignal API envía push
4. Usuario recibe en dispositivo
```

## Configuración de Google Calendar

### OAuth Flow

```
1. Usuario inicia auth → google-calendar-auth
2. Redirección a Google OAuth
3. Callback → google-calendar-callback
4. Token almacenado en google_calendar_tokens
5. Sincronización → google-calendar-sync
```

### Secrets requeridos

- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `FRONTEND_URL`

## Mantenimiento de Documentación

### Regla obligatoria

> Cada modificación funcional, visual, lógica o técnica del aplicativo debe reflejarse en el directorio `/docs`.

### Qué documentar

| Tipo de cambio | Documento a actualizar |
|----------------|----------------------|
| Nueva tabla/columna | `base_de_datos.md` |
| Nueva Edge Function | `api.md` |
| Nuevo rol/permiso | `configuracion.md` |
| Nueva funcionalidad | `manual_basico.md` |
| Cambio de UI importante | `tutorial_inicio.md` |
| Cambio de arquitectura | `estructura.md` |

---

*Última actualización: 22 de enero de 2026*
