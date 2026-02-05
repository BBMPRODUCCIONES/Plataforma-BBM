
# Plan: Eliminar Refrescos Automáticos Manteniendo Tiempo Real

## Diagnóstico del Problema

He identificado la causa exacta de los refrescos automáticos cada ~5 minutos:

### Causa Raíz
La configuración actual del **Service Worker (PWA)** está configurada para:
1. **Auto-actualizar agresivamente** (`registerType: "autoUpdate"` + `skipWaiting: true`)
2. **Forzar refresh inmediato** cuando detecta una nueva versión del Service Worker
3. **Verificar actualizaciones continuamente** en el archivo `main.tsx`

El flujo problemático es:
```text
+---------------------------+     +----------------------+     +------------------+
| Lovable publica cambios   | --> | SW detecta nueva     | --> | controllerchange |
| o rebuild automático      |     | versión (updatefound)|     | dispara reload() |
+---------------------------+     +----------------------+     +------------------+
```

Esto sucede aproximadamente cada 5 minutos porque el entorno de desarrollo/preview de Lovable puede estar haciendo rebuilds o el Service Worker está verificando actualizaciones periódicamente.

## Solución Propuesta

Cambiar la estrategia de actualización del PWA de "refresh automático" a "notificación al usuario", permitiendo que el usuario decida cuándo actualizar.

### Cambios Técnicos

#### 1. Modificar `vite.config.ts`

Cambiar de `autoUpdate` a `prompt` para que el usuario tenga control:

```typescript
VitePWA({
  registerType: "prompt",  // <-- Cambiar de "autoUpdate" a "prompt"
  // ... resto igual
  workbox: {
    // Remover skipWaiting y clientsClaim para dar control al usuario
    skipWaiting: false,      // <-- Cambiar de true a false
    clientsClaim: false,     // <-- Cambiar de true a false
    // ... resto igual
  }
})
```

#### 2. Modificar `src/main.tsx`

Eliminar el refresh automático y agregar notificación opcional:

```typescript
// En lugar de forzar refresh automático:
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').then((registration) => {
      // Verificar actualizaciones cada 30 minutos (menos agresivo)
      setInterval(() => registration.update(), 30 * 60 * 1000);
      
      registration.addEventListener('updatefound', () => {
        const newWorker = registration.installing;
        if (newWorker) {
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              // Solo notificar, NO forzar refresh
              console.log('[PWA] Nueva versión disponible');
              // Opcionalmente mostrar un toast al usuario
            }
          });
        }
      });
    }).catch(() => {});
    
    // ELIMINAR el listener de controllerchange que hace reload()
  });
}
```

#### 3. Agregar componente de actualización opcional (Mejora)

Crear un componente que muestre un banner discreto cuando hay actualización disponible:

```tsx
// src/components/PWAUpdateBanner.tsx
export function PWAUpdateBanner() {
  const [showUpdate, setShowUpdate] = useState(false);
  
  useEffect(() => {
    // Escuchar cuando hay nueva versión
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.ready.then(registration => {
        registration.addEventListener('updatefound', () => {
          // Mostrar banner solo si el usuario quiere actualizar
          setShowUpdate(true);
        });
      });
    }
  }, []);
  
  if (!showUpdate) return null;
  
  return (
    <div className="fixed bottom-4 right-4 p-3 bg-primary text-white rounded-lg">
      <span>Nueva versión disponible</span>
      <Button onClick={() => window.location.reload()}>
        Actualizar
      </Button>
    </div>
  );
}
```

## Impacto

| Aspecto | Antes | Después |
|---------|-------|---------|
| Refresh automático | Cada ~5 min | Nunca (control del usuario) |
| Datos en tiempo real | Funciona | Sin cambios (Supabase Realtime) |
| Actualizaciones de código | Inmediatas (pérdida de datos) | Cuando el usuario lo decida |
| PWA instalable | Sí | Sí (sin cambios) |

## Notas Importantes

- Los datos en **tiempo real de Supabase** (proyectos, empleados, etc.) no se verán afectados, ya que usan canales de Realtime que son independientes del Service Worker
- El usuario podrá seguir viendo cambios de otros usuarios instantáneamente
- Las actualizaciones de código nuevas se aplicarán cuando el usuario:
  - Haga click en "Actualizar" (si implementamos el banner)
  - Refresque manualmente la página
  - Cierre y vuelva a abrir la aplicación

## Archivos a Modificar

1. `vite.config.ts` - Configuración de VitePWA
2. `src/main.tsx` - Lógica de registro del Service Worker
3. (Opcional) `src/components/PWAUpdateBanner.tsx` - Nuevo componente para notificar actualizaciones
4. (Opcional) `src/App.tsx` - Incluir el banner de actualización
