

## Cambio Solicitado

Actualizar el título de la tarjeta en **Reportes Financieros** de "Gastos de Eventos" a "**Reporte de Gasto de Eventos**".

## Ubicación del Cambio

**Archivo**: `src/pages/PanelReportes.tsx`

El cambio se realizará en la sección `renderFinancierosView()` que muestra las tarjetas de tipos de reportes financieros.

## Cambios Específicos

### 1. Título de la Tarjeta (Línea 94)

| Antes | Después |
|-------|---------|
| Gastos de Eventos | Reporte de Gasto de Eventos |

### 2. Mensaje del ErrorBoundary (Línea 120)

Para mantener consistencia, también se actualizará el mensaje de error:

| Antes | Después |
|-------|---------|
| No se pudo cargar el reporte de Caja Menor | No se pudo cargar el Reporte de Gasto de Eventos |

## Resultado Esperado

Al navegar a **Panel de Reportes → Reportes Financieros**, la tarjeta mostrará el texto "Reporte de Gasto de Eventos" en lugar de "Gastos de Eventos".

## Nota

Después de aprobar este cambio, será necesario **publicar** la aplicación para que se refleje en producción (plataforma.bbmproducciones.com.co).

