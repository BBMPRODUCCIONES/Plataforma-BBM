

# Plan: Implementar "Aprobaciones Pendientes"

## Resumen

Crear la secccion "Aprobaciones Pendientes" dentro de Reportes Financieros, reemplazando la tarjeta placeholder actual. Esta vista consolida todas las solicitudes de presupuesto (cajaMenor) de todos los proyectos en una tabla interactiva con filtros, estados editables y vinculacion a legalizacion.

---

## Estructura de la Vista (segun el informe)

### Barra de Filtros Superior
- **Filtro por**: Dia, Mes, Ano (selectores de fecha)
- **Estatus Presupuestos**: Dropdown con opciones (Pendiente, Aprobado, No aprobado, Todos)
- **Busqueda**: Campo de texto libre para buscar por empleado, CC, descripcion

### Tabla Principal - Columnas

| Columna | Origen de datos | Notas |
|---------|----------------|-------|
| Fecha | `createdAt` del registro cajaMenor | Formato DD/MM/YYYY |
| CC | `centroCostos` del proyecto padre | Centro de costos del evento |
| Empleado | `empleadoNombre` del registro cajaMenor | Nombre del colaborador |
| Requerido para | `evento` del proyecto padre | Nombre del evento asociado |
| Categoria | `recursos` del registro (Caja menor, Anticipos BBM, Recursos propios) | Opciones del formato de solicitud |
| Descripcion | `concepto` del registro cajaMenor | Lo que escribio el usuario |
| Valor | `valor` del registro cajaMenor | Formato moneda COP |
| Estado | `estado` del registro (Pendiente/Aprobado/No aprobado) | Seleccionable por admin |
| Legalizacion | Suma de valores de `legalizacion[]` del mismo empleado en el proyecto | Valor monetario |
| (link) | "Ver Legalizacion" | Boton para navegar al detalle |
| Estado Legaliz. | Estado de legalizacion (Pendiente/Legalizado/Rechazado) | Seleccionable |
| Saldo a favor | `valor` de solicitud - suma legalizacion | Calculo automatico |
| Ver mas | Boton para expandir detalle | Abre modal o navega al proyecto |

---

## Implementacion Tecnica

### 1. Nuevo componente: `src/components/reports/AprobacionesPendientes.tsx`
- Consumir `ProjectsContext` para obtener todos los proyectos
- Aplanar todos los registros `cajaMenor[]` de cada proyecto en filas individuales
- Cada fila enriquecida con datos del proyecto padre (CC, evento)
- Calcular legalizacion y saldo a favor cruzando con `legalizacion[]` del proyecto

### 2. Logica de datos
- Recorrer `projects` y extraer cada `cajaMenorItem` junto con metadata del proyecto
- Para cada item, buscar legalizaciones del mismo empleado en el mismo proyecto
- Saldo a favor = valor solicitud - suma legalizaciones del empleado

### 3. Filtros
- Filtro por fecha: dia/mes/ano usando date-fns
- Filtro por estatus: Pendiente, Aprobado, No aprobado
- Busqueda libre: filtra por empleado, CC, descripcion, evento

### 4. Acciones en la tabla
- **Estado**: Dropdown inline para cambiar entre Pendiente/Aprobado/No aprobado (solo admin)
- **Ver Legalizacion**: Navegar o abrir modal con detalle de legalizaciones del empleado en ese proyecto
- **Ver mas**: Abrir detalle completo del registro

### 5. Actualizar `PanelReportes.tsx`
- Agregar nueva vista `"aprobaciones"` al tipo `ReportView`
- Hacer clickeable la tarjeta "Aprobaciones Pendientes" (quitar `opacity-50` y `cursor-not-allowed`)
- Renderizar `AprobacionesPendientes` cuando `currentView === "aprobaciones"`

### 6. Permisos
- Solo usuarios con rol `administrador` pueden cambiar estados
- Usuarios `operativo` y `visual` pueden ver pero no modificar

---

## Archivos a crear/modificar
- **Crear**: `src/components/reports/AprobacionesPendientes.tsx`
- **Modificar**: `src/pages/PanelReportes.tsx` (nueva vista y activar tarjeta)
