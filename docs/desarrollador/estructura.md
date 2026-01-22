# Estructura del Proyecto

## Visión General

BBM Producciones es una aplicación React construida con Vite, TypeScript y Tailwind CSS, conectada a Lovable Cloud (Supabase) como backend.

## Estructura de Directorios

```
/
├── docs/                          # Documentación técnica
├── public/                        # Archivos estáticos
│   ├── OneSignalSDKWorker.js     # Service worker para push
│   ├── pwa-192x192.png           # Íconos PWA
│   └── favicon.ico
├── src/
│   ├── assets/                    # Recursos estáticos (imágenes)
│   ├── components/                # Componentes React
│   │   ├── ui/                   # Componentes UI base (shadcn)
│   │   └── reports/              # Componentes de reportes
│   ├── contexts/                  # Contextos React (estado global)
│   ├── data/                      # Datos mock y constantes
│   ├── hooks/                     # Custom hooks
│   ├── integrations/              # Integraciones externas
│   │   └── supabase/             # Cliente y tipos de Supabase
│   ├── lib/                       # Utilidades y helpers
│   ├── pages/                     # Páginas/rutas de la app
│   ├── types/                     # Definiciones TypeScript
│   ├── utils/                     # Funciones utilitarias
│   ├── App.tsx                    # Componente raíz
│   ├── main.tsx                   # Entry point
│   └── index.css                  # Estilos globales
├── supabase/
│   ├── config.toml               # Configuración Supabase (auto-generado)
│   └── functions/                # Edge Functions
└── [archivos de configuración]
```

## Componentes Principales

### Páginas (`/src/pages/`)

| Página | Ruta | Descripción |
|--------|------|-------------|
| `Index.tsx` | `/` | Redirección según rol |
| `Auth.tsx` | `/auth` | Login y autenticación |
| `CrearCuenta.tsx` | `/crear-cuenta` | Registro con invitación |
| `PanelGeneral.tsx` | `/general` | Vista general de proyectos |
| `PanelDirectivo.tsx` | `/directivo` | Gestión estratégica (admin) |
| `PanelOperaciones.tsx` | `/operaciones` | Gestión operativa |
| `PanelReportes.tsx` | `/reportes` | Informes (admin) |
| `Proveedores.tsx` | `/proveedores` | Directorio de proveedores |
| `Clientes.tsx` | `/clientes` | Gestión de clientes (admin) |
| `Empleados.tsx` | `/empleados` | Gestión de personal (admin) |
| `Usuarios.tsx` | `/usuarios` | Administración de usuarios |
| `GoogleCalendar.tsx` | `/google-calendar` | Sincronización calendario |

### Contextos (`/src/contexts/`)

| Contexto | Propósito |
|----------|-----------|
| `AuthContext` | Autenticación, sesión, roles y permisos |
| `ProjectsContext` | Estado global de proyectos |
| `ClientesContext` | Gestión de clientes |
| `EmpleadosContext` | Gestión de empleados |
| `ProveedoresContext` | Gestión de proveedores |
| `HorariosContext` | Horarios y calendario |
| `DateRangeContext` | Filtros de rango de fechas |

### Componentes Clave

| Componente | Función |
|------------|---------|
| `Layout.tsx` | Estructura base con sidebar |
| `AppSidebar.tsx` | Navegación lateral |
| `ProtectedRoute.tsx` | Control de acceso por rol |
| `MatrixTable.tsx` | Tabla principal de datos |
| `PurchaseOrderUpload.tsx` | Carga de cotizaciones con IA |
| `EditableCell.tsx` | Celdas editables en tabla |
| `CajaMenorStatusIcon.tsx` | Estados de caja menor |
| `GanttChart.tsx` | Vista Gantt de proyectos |

## Flujo de Datos

### Arquitectura de Estado

```
Supabase (Backend)
       ↓
   React Query (Cache/Sync)
       ↓
   Contexts (Estado Global)
       ↓
   Components (UI)
```

### Flujo: Panel Directivo → Operaciones → Reportes

```
┌─────────────────┐
│ Panel Directivo │  ← Crear/Gestionar proyectos (Admin)
└────────┬────────┘
         │
         ▼
┌─────────────────────┐
│ Panel de Operaciones│  ← Gestión operativa diaria
│                     │
│ • Personal          │
│ • Inventario        │
│ • Caja Menor        │
│ • Cotizaciones      │
└────────┬────────────┘
         │
         ▼
┌─────────────────┐
│ Panel de Reportes│  ← Consolidados financieros (Admin)
└─────────────────┘
```

### Flujo de Autenticación

```
Usuario accede a ruta
       ↓
ProtectedRoute verifica sesión
       ↓
   ¿Autenticado? ───No──→ Redirigir a /auth
       │
      Sí
       ↓
AuthContext carga perfil y rol
       ↓
   ¿Tiene acceso al panel? ───No──→ Mostrar error 403
       │
      Sí
       ↓
Renderizar página
```

## Convenciones de Código

### Nomenclatura

| Tipo | Convención | Ejemplo |
|------|------------|---------|
| Componentes | PascalCase | `PurchaseOrderUpload.tsx` |
| Hooks | camelCase con `use` | `useUserRole.ts` |
| Contextos | PascalCase con `Context` | `AuthContext.tsx` |
| Utilidades | camelCase | `pdfGenerator.ts` |
| Tipos | PascalCase | `Project`, `UserRole` |
| Constantes | UPPER_SNAKE_CASE | `HOLIDAYS_2024` |

### Estados de Proyecto

```typescript
type ProjectStatus = 
  | 'idea'
  | 'desarrollo'
  | 'por_confirmar'
  | 'confirmado'
  | 'en_progreso'
  | 'realizado'
  | 'facturado'
  | 'cancelado';
```

### Roles de Usuario

```typescript
type UserRole = 'administrador' | 'operativo' | 'visual';
```

### Patrones de Código

#### Verificación de Rol

```typescript
// Hook useUserRole
const { isAdmin, canEdit, canAccessPanel } = useUserRole();

// Uso en componente
if (!canAccessPanel('reportes')) {
  return <AccessDenied />;
}
```

#### Consultas a Base de Datos

```typescript
// Usando React Query + Supabase
const { data, isLoading, error } = useQuery({
  queryKey: ['projects'],
  queryFn: async () => {
    const { data, error } = await supabase
      .from('projects')
      .select('*')
      .is('deleted_at', null);
    if (error) throw error;
    return data;
  }
});
```

#### Manejo de Errores

```typescript
try {
  // Operación
} catch (error) {
  console.error('Error:', error);
  toast({
    title: "Error",
    description: error instanceof Error ? error.message : "Error desconocido",
    variant: "destructive",
  });
}
```

## Edge Functions

### Ubicación

Todas las Edge Functions están en `/supabase/functions/`

### Estructura de una función

```typescript
// supabase/functions/nombre-funcion/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Lógica de la función
    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
```

## Archivos de Configuración

| Archivo | Propósito |
|---------|-----------|
| `vite.config.ts` | Configuración de Vite |
| `tailwind.config.ts` | Configuración de Tailwind CSS |
| `tsconfig.json` | Configuración de TypeScript |
| `eslint.config.js` | Reglas de linting |
| `vercel.json` | Configuración de despliegue |

---

*Última actualización: 22 de enero de 2026*
