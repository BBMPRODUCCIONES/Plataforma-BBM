

# Fix: Pantalla en blanco al actualizar la pagina

## Problema
El Service Worker (PWA) esta sirviendo archivos JavaScript y CSS cacheados de versiones anteriores cuando se actualiza la pagina. Esto causa que el HTML nuevo intente cargar modulos JS que ya no existen o que son incompatibles, resultando en una pantalla en blanco.

## Solucion

### 1. Corregir configuracion del Service Worker en `vite.config.ts`
- Agregar `navigateFallback: '/index.html'` para que el SW sirva el HTML correcto en cualquier ruta SPA
- Agregar `navigateFallbackDenylist` para excluir rutas de API (supabase, etc.)
- Cambiar el cacheo de assets estaticos de `StaleWhileRevalidate` a `CacheFirst` con expiracion corta, o mejor aun, excluir los archivos JS hasheados del runtime caching ya que Vite genera nombres unicos por build
- Limpiar caches obsoletos mas agresivamente

### 2. Agregar deteccion de errores de carga en `src/main.tsx`
- Capturar errores de tipo `ChunkLoadError` o `Failed to fetch dynamically imported module`
- Al detectarlos, limpiar caches del SW y forzar una recarga limpia de la pagina
- Esto actua como red de seguridad cuando el SW sirve contenido incompatible

### 3. Envolver `App.tsx` con un ErrorBoundary global
- Agregar un ErrorBoundary de nivel superior que capture errores fatales de renderizado
- Mostrar un mensaje amigable con boton para recargar la pagina en lugar de pantalla en blanco

## Detalles tecnicos

### Cambios en `vite.config.ts`
```text
workbox: {
  navigateFallback: '/index.html',
  navigateFallbackDenylist: [/^\/api/, /^\/auth/, /supabase/],
  skipWaiting: false,
  clientsClaim: false,
  cleanupOutdatedCaches: true,
  // Remove StaleWhileRevalidate for JS/CSS - let browser use normal cache
  runtimeCaching: [
    {
      urlPattern: /^https:\/\/.*\.supabase\.co\/.*/i,
      handler: "NetworkFirst",
      options: { ... }
    }
    // Remove static asset caching to prevent stale bundle issues
  ]
}
```

### Cambios en `src/main.tsx`
Agregar listener global de errores que detecte fallos de carga de modulos:
```text
window.addEventListener('error', (event) => {
  if (event.message?.includes('Failed to fetch') || 
      event.message?.includes('ChunkLoadError')) {
    // Clear SW caches and reload
    caches.keys().then(names => 
      Promise.all(names.map(n => caches.delete(n)))
    ).then(() => window.location.reload());
  }
});
```

### Cambios en `src/App.tsx`
Envolver todo el arbol de componentes con `ErrorBoundary`:
```text
const App = () => (
  <ErrorBoundary title="Error inesperado" description="...">
    <QueryClientProvider client={queryClient}>
      ...
    </QueryClientProvider>
  </ErrorBoundary>
);
```

## Archivos a modificar
- `vite.config.ts` - Configuracion del Service Worker
- `src/main.tsx` - Deteccion de errores de carga
- `src/App.tsx` - ErrorBoundary global

