# Esquema de Base de Datos

## Descripción General

La base de datos de BBM Producciones está diseñada para gestionar eventos/proyectos de producción audiovisual, incluyendo:
- Información de proyectos y eventos
- Gestión de personal y empleados
- Control de caja menor (gastos)
- Inventario y recursos
- Proveedores y cotizaciones
- Gestión de usuarios y roles

## Tablas Principales

### projects (Proyectos/Eventos)

Tabla central que almacena todos los eventos y proyectos.

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `id` | uuid | Identificador único |
| `evento` | text | Nombre del evento |
| `estado` | text | Estado actual del proyecto |
| `cliente_id` | uuid | Referencia al cliente |
| `fecha_inicio` | timestamp | Fecha de inicio |
| `fecha_fin` | timestamp | Fecha de finalización |
| `fecha_montaje` | timestamp | Fecha/hora de montaje |
| `fecha_ejecucion` | timestamp | Fecha/hora de ejecución |
| `fecha_desmonte` | timestamp | Fecha/hora de desmonte |
| `lugar` | text | Ubicación del evento |
| `ciudad` | text | Ciudad del evento |
| `ingreso_total` | numeric | Ingreso total del proyecto |
| `ingreso_bruto` | numeric | Ingreso bruto |
| `responsable_id` | uuid | Empleado responsable |
| `personal` | jsonb | Array de personal asignado |
| `inventario` | jsonb | Array de items de inventario |
| `caja_menor` | jsonb | Array de gastos de caja menor |
| `adjuntos` | jsonb | Array de archivos adjuntos |
| `notas_generales` | text | Notas del proyecto |
| `avanzada` | text | Estado de avanzada (pre-producción) |
| `contingencia` | text | Plan de contingencia |
| `recursos` | text | Recursos adicionales |
| `deleted_at` | timestamp | Soft delete timestamp |
| `created_at` | timestamp | Fecha de creación |
| `updated_at` | timestamp | Última actualización |

#### Estados del proyecto (`estado`)

- `idea` - Proyecto en fase de idea
- `desarrollo` - En desarrollo/planificación
- `por_confirmar` - Pendiente de confirmación
- `confirmado` - Confirmado
- `en_progreso` - En ejecución
- `realizado` - Completado
- `facturado` - Facturado
- `cancelado` - Cancelado

#### Estados de avanzada (`avanzada`)

- `sin_avanzada` - Sin pre-producción
- `solicitar` - Solicitar avanzada
- `solicitada` - Avanzada solicitada
- `aprobada` - Avanzada aprobada
- `entregada` - Avanzada entregada

### clients (Clientes)

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `id` | uuid | Identificador único |
| `nombre` | text | Nombre del cliente |
| `nit` | text | NIT/Identificación fiscal |
| `direccion` | text | Dirección |
| `telefono` | text | Teléfono de contacto |
| `correo` | text | Email de contacto |
| `ciudad` | text | Ciudad |
| `created_at` | timestamp | Fecha de creación |

### employees (Empleados)

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `id` | uuid | Identificador único |
| `nombre` | text | Nombre completo |
| `cargo` | text | Cargo/Posición |
| `telefono` | text | Teléfono (solo visible para admins) |
| `correo` | text | Email (vinculado a usuario si aplica) |
| `banco` | text | Banco para pagos |
| `tipo_cuenta` | text | Tipo de cuenta bancaria |
| `numero_cuenta` | text | Número de cuenta |
| `cedula` | text | Cédula de identidad |
| `deleted_at` | timestamp | Soft delete |
| `created_at` | timestamp | Fecha de creación |

**Nota**: Existe relación 1:1 entre usuarios y empleados basada en email.

### suppliers (Proveedores)

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `id` | uuid | Identificador único |
| `nombre` | text | Nombre del proveedor |
| `categoria` | text | Categoría de servicio |
| `telefono` | text | Teléfono de contacto |
| `correo` | text | Email de contacto |
| `ciudad` | text | Ciudad |
| `contacto` | text | Persona de contacto |
| `notas` | text | Notas adicionales |
| `created_at` | timestamp | Fecha de creación |

### user_roles (Roles de Usuario)

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `id` | uuid | Identificador único |
| `user_id` | uuid | Referencia a auth.users |
| `role` | app_role | Rol asignado |
| `allowed_panels` | text[] | Paneles permitidos |
| `puede_ver_feedback` | boolean | Flag de permiso |
| `puede_editar_feedback` | boolean | Flag de permiso |
| `created_at` | timestamp | Fecha de creación |

**Roles disponibles** (`app_role`): `administrador`, `operativo`, `visual`

### invitations (Invitaciones)

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `id` | uuid | Identificador único |
| `token` | uuid | Token único de invitación |
| `email` | text | Email del invitado |
| `role` | app_role | Rol a asignar |
| `allowed_panels` | text[] | Paneles a asignar |
| `invited_by` | uuid | Usuario que invitó |
| `expires_at` | timestamp | Fecha de expiración |
| `accepted_at` | timestamp | Fecha de aceptación |
| `created_at` | timestamp | Fecha de creación |

### notifications (Notificaciones)

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `id` | uuid | Identificador único |
| `user_id` | uuid | Usuario destinatario |
| `title` | text | Título de la notificación |
| `message` | text | Contenido |
| `type` | text | Tipo de notificación |
| `read` | boolean | Estado de lectura |
| `created_at` | timestamp | Fecha de creación |

### profiles (Perfiles de Usuario)

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `id` | uuid | Referencia a auth.users |
| `email` | text | Email del usuario |
| `full_name` | text | Nombre completo |
| `is_active` | boolean | Estado activo/inactivo |
| `created_at` | timestamp | Fecha de creación |
| `updated_at` | timestamp | Última actualización |

## Estructuras JSONB

### Personal (en projects.personal)

```json
[
  {
    "id": "uuid",
    "nombre": "Nombre del trabajador",
    "cargo": "Cargo",
    "tipo": "interno|externo",
    "telefono": "3001234567",
    "correo": "email@ejemplo.com"
  }
]
```

### Inventario (en projects.inventario)

```json
[
  {
    "id": "uuid",
    "nombre": "Nombre del item",
    "cantidad": 5,
    "unidad": "und|m|kg|etc"
  }
]
```

### Caja Menor (en projects.caja_menor)

```json
[
  {
    "id": "uuid",
    "concepto": "Descripción del gasto",
    "valor": 150000,
    "categoria": "transporte|alimentacion|materiales|etc",
    "estado": "pendiente|aprobado|rechazado",
    "fecha": "2026-01-22",
    "responsable_id": "uuid",
    "recibo_numero": "001",
    "proveedor": "Nombre proveedor"
  }
]
```

### Adjuntos (en projects.adjuntos)

```json
[
  {
    "id": "uuid",
    "name": "nombre_archivo.pdf",
    "url": "path/en/storage",
    "type": "application/pdf",
    "size": 1024,
    "uploadedAt": "2026-01-22T10:00:00Z",
    "uploadedBy": "usuario@email.com"
  }
]
```

## Relaciones Entre Tablas

```
auth.users
    ├── profiles (1:1 por id)
    ├── user_roles (1:1 por user_id)
    └── employees (1:1 por correo - email)

projects
    ├── clients (N:1 por cliente_id)
    └── employees (N:1 por responsable_id)

suppliers
    └── supplier_cotizacion_history (1:N)

invitations
    └── auth.users (N:1 por invited_by)
```

## Soft Delete

Las siguientes tablas implementan soft delete con el campo `deleted_at`:
- `projects`
- `employees`

**Importante**: Las consultas deben filtrar `WHERE deleted_at IS NULL` para excluir registros eliminados.

## Funciones de Base de Datos

### has_role(user_id, role)
Verifica si un usuario tiene un rol específico.

### get_employees_for_role()
Retorna empleados filtrados según el rol del usuario actual.

### get_employee_name_by_id(employee_id)
Obtiene el nombre de un empleado por su ID.

### get_my_employee()
Obtiene el empleado vinculado al usuario actual (por email).

### validate_invitation_by_token(token)
Valida y retorna información de una invitación.

---

*Última actualización: 22 de enero de 2026*
