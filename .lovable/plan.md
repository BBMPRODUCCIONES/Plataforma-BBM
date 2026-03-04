

## Plan: Barra de scroll horizontal siempre visible

### Problema
Cuando hay muchos eventos, la barra de scroll horizontal queda al final de la tabla y hay que bajar hasta allí para poder desplazarse lateralmente.

### Solución propuesta
Implementar una **barra de scroll horizontal fija (sticky)** que se mantenga visible en la parte inferior del viewport mientras la tabla esté en pantalla. Esto aplica a los 3 paneles principales: Panel Directivo, Panel General y Panel Operaciones.

### Enfoque técnico

1. **Modificar `MatrixTable.tsx`** — Agregar un div sincronizado de scroll que se posicione como `position: sticky; bottom: 0` dentro del contenedor. Este div replica el ancho total de la tabla y su scrollbar se sincroniza bidireccionalmente con el contenedor real de la tabla mediante eventos `onScroll`.

2. **Agregar estilos en `src/index.css`** — CSS para la barra sticky:
   - `position: sticky; bottom: 0; z-index: 10`
   - Scrollbar estilizada y siempre visible
   - Ocultar la scrollbar del contenedor principal (ya que la sticky la reemplaza)
   - Solo en desktop (en móvil el scroll táctil funciona diferente)

3. **Sin cambios en los paneles** — La solución vive dentro de `MatrixTable`, por lo que los 3 paneles se benefician automáticamente sin modificar `PanelDirectivo.tsx`, `PanelGeneral.tsx` ni `PanelOperaciones.tsx`.

### Resultado
Al hacer scroll vertical por la lista de eventos, la barra horizontal permanece anclada en la parte inferior visible de la pantalla, permitiendo desplazarse lateralmente en cualquier momento sin tener que bajar hasta el final de la tabla.

