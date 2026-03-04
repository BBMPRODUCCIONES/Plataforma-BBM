

## Plan: Crear panel "Hola"

Se creará una nueva página vacía llamada "Hola" y se agregará a la navegación justo debajo de "Panel Operaciones".

### Cambios necesarios

1. **Crear `src/pages/Hola.tsx`** — Página vacía con el layout estándar (sidebar, header, contenido vacío).

2. **Agregar ruta en `src/App.tsx`** — Nueva ruta `/hola` con `ProtectedRoute`, ubicada después de la ruta de Panel Operaciones.

3. **Agregar al sidebar (`src/components/AppSidebar.tsx`)** — Nuevo item "Hola" en `mainNavItems` justo después de "Panel Operaciones".

4. **Agregar al nav móvil (`src/components/MobileBottomNav.tsx`)** — Nuevo item "Hola" en la lista de navegación, después de "Operaciones".

