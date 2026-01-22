# Documentación de APIs

## Arquitectura General

La plataforma BBM Producciones utiliza **Lovable Cloud (Supabase)** como backend, lo que proporciona:

- **Base de datos PostgreSQL** con Row Level Security (RLS)
- **Autenticación** integrada con Supabase Auth
- **Edge Functions** para lógica de servidor personalizada
- **Storage** para almacenamiento de archivos

## Autenticación y Roles

### Sistema de autenticación

La autenticación se maneja mediante Supabase Auth con:
- Login por email/contraseña
- Auto-confirmación de email habilitada
- Sesiones JWT

### Roles del sistema

| Rol | Descripción | Permisos |
|-----|-------------|----------|
| `administrador` | Acceso completo | CRUD total + gestión de usuarios + todos los paneles |
| `operativo` | Acceso operacional | Ver/editar contenido + paneles general/operaciones/proveedores |
| `visual` | Solo lectura | Ver información + paneles general/operaciones/proveedores |

### Permisos adicionales (flags)

| Flag | Descripción |
|------|-------------|
| `puede_ver_feedback` | Permite ver sección de feedback |
| `puede_editar_feedback` | Permite editar feedback |

### Función de verificación de rol

```sql
-- Verifica si un usuario tiene un rol específico
SELECT public.has_role(auth.uid(), 'administrador');
```

## Edge Functions

### Endpoints disponibles

| Función | Método | Descripción |
|---------|--------|-------------|
| `/accept-invitation` | POST | Acepta una invitación y crea el usuario |
| `/create-invitation` | POST | Crea invitación para nuevo usuario |
| `/validate-invitation` | POST | Valida token de invitación |
| `/delete-user` | POST | Elimina/desactiva un usuario |
| `/reactivate-user` | POST | Reactiva un usuario desactivado |
| `/get-signed-url` | POST | Genera URL firmada para archivos privados |
| `/process-purchase-order` | POST | Procesa imagen de OC con IA |
| `/send-push-notification` | POST | Envía notificación push via OneSignal |
| `/google-calendar-auth` | GET | Inicia OAuth con Google Calendar |
| `/google-calendar-callback` | GET | Callback de OAuth Google |
| `/google-calendar-sync` | POST | Sincroniza eventos con Google Calendar |

### Ejemplo: Procesar orden de compra

```typescript
const { data, error } = await supabase.functions.invoke('process-purchase-order', {
  body: {
    fileData: base64Data,
    fileName: 'cotizacion.pdf',
    fileType: 'application/pdf'
  }
});

// Respuesta exitosa
{
  success: true,
  data: {
    ingresoTotal: 15000000,
    ingresoBruto: 12600000,
    inventario: [
      { nombre: "Pantalla LED", cantidad: 2, unidad: "und" }
    ]
  }
}
```

### Ejemplo: Crear invitación

```typescript
const { data, error } = await supabase.functions.invoke('create-invitation', {
  body: {
    email: 'nuevo@usuario.com',
    role: 'operativo',
    allowed_panels: ['general', 'operaciones']
  }
});
```

## Flujos de Datos Principales

### Flujo: Creación de Proyecto

```
1. Usuario crea proyecto en Panel General/Directivo
   ↓
2. Se inserta registro en tabla `projects`
   ↓
3. RLS verifica permisos del usuario
   ↓
4. Proyecto visible en Panel de Operaciones
   ↓
5. Usuario puede agregar caja menor, personal, inventario
```

### Flujo: Panel Directivo → Operaciones → Reportes

```
Panel Directivo (crear/editar proyectos)
        ↓
Panel Operaciones (gestión operativa, caja menor)
        ↓
Panel Reportes (consolidados financieros)
```

### Flujo: Carga de Cotización con IA

```
1. Usuario sube imagen/PDF de cotización
   ↓
2. Frontend convierte a base64
   ↓
3. Edge Function `process-purchase-order` recibe archivo
   ↓
4. Lovable AI (Gemini) extrae datos
   ↓
5. Datos retornan al frontend
   ↓
6. Usuario confirma y guarda valores
```

## Políticas RLS (Row Level Security)

### Tabla: projects

```sql
-- Solo usuarios autenticados pueden ver proyectos
CREATE POLICY "Authenticated users can view projects"
ON projects FOR SELECT TO authenticated
USING (true);

-- Solo admins y operativos pueden modificar
CREATE POLICY "Admins and operativos can modify"
ON projects FOR ALL TO authenticated
USING (
  public.has_role(auth.uid(), 'administrador') OR
  public.has_role(auth.uid(), 'operativo')
);
```

### Tabla: employees

Los empleados se acceden a través de la función `get_employees_for_role()`:
- **Administrador**: Ve todos los campos
- **Operativo**: Ve campos limitados (sin teléfono, correo, cuenta bancaria)
- **Visual**: No tiene acceso

## Storage Buckets

| Bucket | Público | Uso |
|--------|---------|-----|
| `project-attachments` | No | Archivos adjuntos de proyectos |
| `supplier-cotizaciones` | No | Cotizaciones de proveedores |
| `notes-images` | Sí | Imágenes en notas |

### Obtener URL firmada para archivos privados

```typescript
const { data } = await supabase.functions.invoke('get-signed-url', {
  body: {
    bucket: 'project-attachments',
    path: 'ruta/archivo.pdf'
  }
});

// data.signedUrl contiene la URL temporal
```

## Manejo de Errores

### Códigos de error comunes

| Código | Significado | Acción |
|--------|-------------|--------|
| `PGRST301` | JWT expirado | Refrescar sesión |
| `42501` | Violación RLS | Verificar permisos |
| `23505` | Duplicado único | Registro ya existe |
| `FunctionsFetchError` | Edge function falló | Ver logs de función |

### Ejemplo de manejo de errores

```typescript
try {
  const { data, error } = await supabase.from('projects').select('*');
  
  if (error) {
    if (error.code === '42501') {
      toast.error('No tienes permisos para esta acción');
    } else {
      toast.error('Error al cargar datos');
    }
    return;
  }
  
  // Procesar data...
} catch (e) {
  console.error('Error inesperado:', e);
}
```

---

*Última actualización: 22 de enero de 2026*
