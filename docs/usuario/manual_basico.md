# Manual Básico de Usuario

## Introducción

BBM Producciones es una plataforma de gestión de eventos y proyectos de producción audiovisual. Este manual cubre las funcionalidades principales según el rol del usuario.

## Navegación General

### Menú lateral (Sidebar)

El menú lateral permite acceder a las diferentes secciones de la plataforma:

| Sección | Descripción | Roles con acceso |
|---------|-------------|------------------|
| **Panel General** | Vista general de proyectos | Todos |
| **Panel Directivo** | Gestión estratégica | Solo Administrador |
| **Panel de Operaciones** | Gestión operativa detallada | Todos |
| **Panel de Reportes** | Informes financieros | Solo Administrador |
| **Proveedores** | Directorio de proveedores | Todos |
| **Clientes** | Gestión de clientes | Solo Administrador |
| **Empleados** | Gestión de personal | Solo Administrador |
| **Gestión de Usuarios** | Administración de usuarios | Solo Administrador |
| **Google Calendar** | Sincronización de calendario | Todos |

### Barra superior

- **Logo BBM**: Volver al inicio
- **Notificaciones**: Campana con alertas pendientes
- **Menú de usuario**: Cerrar sesión

## Roles y Permisos

### Usuario Administrador

**Acceso completo a todas las funcionalidades:**

✅ **Puede hacer:**
- Crear, editar y eliminar proyectos
- Gestionar clientes y proveedores
- Administrar empleados
- Invitar y gestionar usuarios
- Ver todos los paneles incluido Reportes
- Configurar columnas y campos personalizados
- Acceder a Caja Menor y aprobar gastos
- Exportar información
- Ver información sensible de empleados

### Usuario Operativo

**Acceso operacional para gestión diaria:**

✅ **Puede hacer:**
- Ver todos los proyectos
- Editar información de proyectos
- Agregar personal, inventario y caja menor
- Cargar cotizaciones y documentos
- Ver directorio de proveedores
- Sincronizar Google Calendar
- Exportar información

❌ **No puede hacer:**
- Crear nuevos proyectos (solo en Panel Directivo)
- Gestionar clientes
- Ver información sensible de empleados (teléfono, cuenta bancaria)
- Administrar usuarios
- Acceder a Panel de Reportes
- Configurar columnas personalizadas

### Usuario Visual

**Acceso de solo lectura:**

✅ **Puede hacer:**
- Ver proyectos y su información
- Consultar directorio de proveedores
- Ver calendario de eventos
- Exportar información visible

❌ **No puede hacer:**
- Editar ninguna información
- Agregar proyectos, personal o gastos
- Gestionar clientes o empleados
- Acceder a paneles administrativos

## Secciones Principales

### Panel General

Vista consolidada de todos los proyectos con:
- Tabla de proyectos activos
- Filtros por estado, fecha, cliente
- Búsqueda rápida
- Estadísticas generales

**Acciones disponibles:**
- Filtrar proyectos por diferentes criterios
- Ordenar columnas
- Exportar a Excel

### Panel de Operaciones

Gestión detallada de cada proyecto:

#### Información General
- Nombre del evento
- Cliente asociado
- Fechas (montaje, ejecución, desmonte)
- Lugar y ciudad
- Estado del proyecto
- Responsable asignado

#### Sección Cotización
- **Cargar OC**: Subir imagen o PDF de cotización
  - El sistema extrae automáticamente valores usando IA
  - Ingreso total e ingreso bruto
  - Items de inventario

#### Sección Personal
- Agregar personal interno o externo
- Asignar cargos y responsabilidades
- Información de contacto

#### Sección Inventario
- Listado de equipos y materiales
- Cantidades y unidades
- Control de recursos

#### Sección Caja Menor
- Registrar gastos del evento
- Categorías de gasto
- Estados (pendiente, aprobado, rechazado)
- Numeración de recibos

#### Adjuntos
- Subir documentos relacionados
- Fotos, contratos, cotizaciones
- Organización por proyecto

### Proveedores

Directorio completo de proveedores:
- Información de contacto
- Categorías de servicio
- Historial de cotizaciones
- Notas y observaciones

### Google Calendar

Sincronización bidireccional con Google Calendar:
- Conectar cuenta de Google
- Sincronizar eventos
- Ver calendario integrado

## Funcionalidades Especiales

### Cargar Cotización (OC) con IA

1. En Panel de Operaciones, ubicar la columna "COTIZACIÓN"
2. Clic en **"Cargar OC"**
3. Seleccionar imagen (JPG, PNG) o PDF de la cotización
4. El sistema procesa automáticamente y extrae:
   - Ingreso total
   - Ingreso bruto
   - Items de inventario con cantidades

5. Revisar y confirmar los datos extraídos

### Filtros de Calendario

- **Vista por mes/semana/día**
- **Filtro por estado**: Ver solo proyectos confirmados, en progreso, etc.
- **Filtro por fecha**: Rango de fechas específico

### Exportar a Excel

1. Aplicar los filtros deseados
2. Clic en botón "Exportar"
3. Se descarga archivo Excel con los datos visibles

## Atajos y Tips

| Acción | Tip |
|--------|-----|
| Búsqueda rápida | Usar el campo de búsqueda en la parte superior |
| Editar celda | Doble clic en la celda (si tienes permisos) |
| Ver proyecto completo | Expandir fila en Panel de Operaciones |
| Cambiar estado rápido | Usar selector de estado en la tabla |

## Solución de Problemas

### "No puedo ver cierta información"
- Verifica tu rol de usuario
- Algunos datos solo son visibles para administradores

### "No puedo editar"
- Los usuarios Visuales no pueden editar
- Verifica que no estés en modo de solo lectura

### "La cotización no se procesa"
- Asegúrate de que la imagen sea clara y legible
- Formatos soportados: JPG, PNG, PDF
- Si falla, los datos se pueden ingresar manualmente

### "No veo mis cambios"
- Refresca la página
- Los cambios se guardan automáticamente

---

*Última actualización: 22 de enero de 2026*
