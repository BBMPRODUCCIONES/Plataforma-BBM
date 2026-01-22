# Guía de Instalación y Despliegue

## Requisitos del Sistema

### Requisitos técnicos

| Requisito | Versión mínima |
|-----------|----------------|
| Node.js | 18.x o superior |
| npm | 9.x o superior |
| Navegador moderno | Chrome 90+, Firefox 88+, Safari 14+, Edge 90+ |

### Dependencias principales

- **React** 18.3.1
- **Vite** (bundler)
- **TypeScript** (tipado estático)
- **Tailwind CSS** (estilos)
- **Supabase JS** 2.86.0 (backend)
- **TanStack React Query** 5.x (gestión de estado servidor)

## Ambientes

### Producción

| Campo | Valor |
|-------|-------|
| **URL** | https://projectmatrix-hub.lovable.app |
| **Backend** | Lovable Cloud (Supabase) |
| **ID Proyecto Supabase** | qbcwvrtiedzvsurndizd |

### Preview/Desarrollo

| Campo | Valor |
|-------|-------|
| **URL** | https://id-preview--82dfe78f-654a-44d8-8777-d98857e7d341.lovable.app |
| **Propósito** | Pruebas y desarrollo |

## Variables de Entorno

Las siguientes variables son configuradas automáticamente por Lovable Cloud:

```env
VITE_SUPABASE_URL=https://qbcwvrtiedzvsurndizd.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=[anon_key]
VITE_SUPABASE_PROJECT_ID=qbcwvrtiedzvsurndizd
```

### Secrets configurados en Edge Functions

| Secret | Descripción |
|--------|-------------|
| `SUPABASE_SERVICE_ROLE_KEY` | Clave de servicio para operaciones administrativas |
| `ONESIGNAL_REST_API_KEY` | API key para notificaciones push |
| `GOOGLE_CLIENT_ID` | OAuth para Google Calendar |
| `GOOGLE_CLIENT_SECRET` | Secret para Google Calendar |
| `FRONTEND_URL` | URL del frontend para callbacks |
| `LOVABLE_API_KEY` | API key para funciones de IA |

## Pasos para Desarrollo Local

### 1. Clonar el repositorio

```bash
git clone <URL_DEL_REPOSITORIO>
cd <NOMBRE_DEL_PROYECTO>
```

### 2. Instalar dependencias

```bash
npm install
```

### 3. Iniciar servidor de desarrollo

```bash
npm run dev
```

El servidor estará disponible en `http://localhost:5173`

## Despliegue

### Despliegue en Lovable

1. Realizar cambios en el código
2. Los cambios se despliegan automáticamente en preview
3. Para publicar a producción: **Publish → Update**

### Notas importantes

- **Cambios de frontend**: Requieren clic en "Update" para ir a producción
- **Cambios de backend** (Edge Functions, migraciones): Se despliegan automáticamente
- **Edge Functions**: Se despliegan al guardar cambios en `/supabase/functions/`

## Errores Comunes

### Error: "Cannot connect to Supabase"

**Causa**: Variables de entorno no configuradas o proyecto desconectado

**Solución**: Verificar que el proyecto tenga Lovable Cloud habilitado

### Error: "RLS policy violation"

**Causa**: Usuario sin permisos para la operación

**Solución**: Verificar rol del usuario y políticas RLS de la tabla

### Error: "Edge function timeout"

**Causa**: Función tarda más de 60 segundos

**Solución**: Optimizar la función o aumentar el tamaño de instancia en Settings → Cloud → Advanced

### Error al subir archivos

**Causa**: Límite de tamaño o tipo de archivo no permitido

**Solución**: Verificar que el archivo sea menor a 50MB y sea un tipo permitido

## Mantenimiento

### Actualizar dependencias

```bash
npm update
```

### Verificar vulnerabilidades

```bash
npm audit
```

### Limpiar cache

```bash
npm cache clean --force
rm -rf node_modules
npm install
```

---

*Última actualización: 22 de enero de 2026*
