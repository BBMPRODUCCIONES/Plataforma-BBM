// SSOT Types - Updated according to Excel structure
export interface Project {
  id: string;
  centroCostos: string;
  numFactura: string;
  cliente: string;
  evento: string;
  avanzada?: 'SE_HIZO' | 'NO_SE_HIZO' | 'NO_NECESARIA';
  fechaMontajeInicio: string;
  fechaMontajeFin: string;
  horaMontajeInicio?: string;
  horaMontajeFin?: string;
  fechaEjecucionInicio: string;
  fechaEjecucionFin: string;
  horaEjecucionInicio?: string;
  horaEjecucionFin?: string;
  // Desmontaje date range
  fechaDesmontajeInicio?: string;
  fechaDesmontajeFin?: string;
  horaDesmontajeInicio?: string;
  horaDesmontajeFin?: string;
  estado: ProjectStatus;
  // Panel Directivo fields
  administrativoResponsable?: string;
  ingresoTotal?: number;
  ingresoBruto?: number;
  cotizaciones?: Attachment[];
  ordenesCompra?: Attachment[];
  // Panel Operaciones fields
  jefeOperaciones?: string;
  aCargoDe?: string;
  productor?: string;
  ubicacion?: string;
  formatoPreproduccion?: Attachment[];
  personal?: PersonalItem[];
  cotizacionesProveedor?: Attachment[];
  notasCotizacionProveedor?: string;
  notas?: string;
  notasImagenes?: NotasImage[];
  inventario?: InventarioItem[];
  // Feedback section
  feedback?: string;
  feedbackAdjuntos?: Attachment[];
  // Caja Menor section (Panel Operaciones only)
  cajaMenor?: CajaMenorItem[];
  // Legalización section (datos independientes de cajaMenor)
  legalizacion?: LegalizacionItem[];
  // Inventory responsables (project-level) - legacy fields kept for backward compat
  inventarioResponsableEntradasSalidasTipo?: 'empleado' | 'proveedor';
  inventarioResponsableEntradasSalidasId?: string;
  inventarioResponsableEntradasSalidasNombre?: string;
  inventarioResponsableMaterialEventoTipo?: 'empleado' | 'proveedor';
  inventarioResponsableMaterialEventoId?: string;
  inventarioResponsableMaterialEventoNombre?: string;
  // New auto-login responsables
  inventarioResponsableSalidaUserId?: string;
  inventarioResponsableSalidaNombre?: string;
  inventarioResponsableSalidaTimestamp?: string;
  inventarioResponsableEntradaUserId?: string;
  inventarioResponsableEntradaNombre?: string;
  inventarioResponsableEntradaTimestamp?: string;
  inventarioResponsableEventoUserId?: string;
  inventarioResponsableEventoNombre?: string;
  inventarioResponsableEventoTimestamp?: string;
  // Soft delete fields
  isDeleted?: boolean;
  deletedAt?: string;
  deletedBy?: string;
  deletedByEmail?: string;
  createdAt: string;
  updatedAt: string;
}

export interface NotasImage {
  id: string;
  url: string;
  name: string;
}

// Updated status according to requirements
export type ProjectStatus = 'por_planear' | 'por_ejecutar' | 'en_progreso' | 'terminado' | 'facturado';

export interface Attachment {
  id: string;
  name: string;
  url: string;
  type: string;
  size?: number;
  uploadedAt: string;
  filePath?: string; // Path in Supabase Storage for persistent files
  bucket?: string; // Storage bucket name
  // Per-quotation income fields (for cotizaciones)
  ingresoBruto?: number;
  ingresoTotal?: number;
}

export interface PersonalItem {
  id: string;
  empleadoId?: string; // ID del empleado vinculado (solo para tipo BBM)
  proveedorId?: string; // ID del proveedor vinculado (solo para tipo Proveedor/Transporte)
  nombre: string;
  cargo: string;
  telefono: string;
  tipoPersonal: 'BBM' | 'Proveedor' | 'Transporte';
  cedula?: string; // Cédula del personal (BBM: auto desde DB, Proveedor/Transporte: manual)
  cedulaOrigen?: 'empleado' | 'manual'; // Para auditoría: origen de la cédula
  notas?: string;
  rutaTransporte?: string; // Campo para la ruta cuando es Transporte
  adjuntos?: Attachment[]; // Archivos adjuntos (solo para Proveedor y Transporte)
  feedback?: string; // Feedback del personal
}

export interface InventarioItem {
  id: string;
  nombreMaterial: string;
  cantidad: number;
  unidad: string;
  observaciones?: string;
  recibido: boolean;
  notasAdicionales?: string;
  // Responsables fields
  responsableEntradasSalidasTipo?: 'empleado' | 'proveedor';
  responsableEntradasSalidasId?: string;
  responsableEntradasSalidasNombre?: string;
  responsableMaterialEventoTipo?: 'empleado' | 'proveedor';
  responsableMaterialEventoId?: string;
  responsableMaterialEventoNombre?: string;
}

// Inventory Responsables (Project-level for all inventory items)
export interface InventarioResponsables {
  responsableEntradasSalidasTipo?: 'empleado' | 'proveedor';
  responsableEntradasSalidasId?: string;
  responsableEntradasSalidasNombre?: string;
  responsableMaterialEventoTipo?: 'empleado' | 'proveedor';
  responsableMaterialEventoId?: string;
  responsableMaterialEventoNombre?: string;
}

export interface RelacionGastoEntry {
  comercio: string;
  nitCedula: string;
  concepto: string;
  valor?: number;
  imagen_url?: string;
}

export interface CajaMenorItem {
  id: string;
  empleadoId?: string; // ID del empleado/colaborador vinculado
  empleadoNombre?: string; // Nombre del empleado (snapshot)
  empleadoEmail?: string; // Email del empleado (para permisos por usuario)
  concepto: string;
  imagenes?: Attachment[];
  valor: number;
  categoria: 'Transporte' | 'Alimentación' | 'Compras' | 'Anticipo' | '';
  recursos: 'Recursos propios' | 'BBM' | 'Anticipo BBM' | ''; // Obligatorio
  contingencia: 'Sí' | 'No'; // Default: 'No'
  estado: 'Pendiente' | 'Aprobado' | 'No aprobado';
  procesoPago?: 'Pagado' | 'No pagado' | ''; // Campo para reportes (solo Admin puede editar)
  revisadoPor?: string; // Nombre de quien aprobó/rechazó
  createdAt?: string; // Fecha de creación del registro
  relacion_gastos?: RelacionGastoEntry[]; // Datos para RELACIÓN DE GASTOS en PDF
  restaurada?: boolean; // Indica si fue restaurada desde aprobadas/rechazadas
}

// Legalización item - estructura independiente para justificar gastos
export interface LegalizacionItem {
  id: string;
  empleadoId?: string;
  empleadoNombre?: string;
  empleadoEmail?: string;
  concepto: string;
  notaAdicional?: string; // Nota adicional editable sin modificar concepto original
  imagenes?: Attachment[]; // Obligatorio para legalización
  valor: number;
  categoria: 'Transporte' | 'Alimentación' | 'Compras' | '';
  recursos: 'Recursos propios' | 'BBM' | 'Anticipo BBM' | '';
  contingencia: 'Sí' | 'No';
  estado: 'Pendiente' | 'Aprobado' | 'No aprobado';
  revisadoPor?: string; // Nombre de quien aprobó/rechazó
  createdAt?: string;
  restaurada?: boolean; // Indica si fue restaurada desde aprobadas/rechazadas
}

export interface Proveedor {
  id: string;
  categoria: string;
  nombre: string;
  telefono: string;
  correo: string;
  tipoProductoServicio: string;
  cotizacionesAnteriores?: Attachment[];
  notas?: string;
  banco?: string;
  tipoCuenta?: string;
  numeroCuenta?: string;
  certificadoBancario?: string; // URL del certificado bancario
}

export interface Cliente {
  id: string;
  nombre: string;
  nit: string;
  createdAt: string;
}

// Roles & Permissions
export type UserRole = 'administrador' | 'operativo' | 'visual';

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  panelsAccess: string[];
  avatar?: string;
}

// Field Constructor Types
export type FieldType = 'text' | 'number' | 'list' | 'file' | 'boolean' | 'date' | 'dateRange' | 'datetime' | 'relation' | 'multiselect';

export interface CustomField {
  id: string;
  name: string;
  key: string;
  type: FieldType;
  isSSOT: boolean;
  panels: string[];
  affectsGantt: boolean;
  ganttColor?: string;
  syncEnabled: boolean;
  options?: string[];
  required?: boolean;
  allowMultipleFiles?: boolean;
  order: number;
}

// Gantt Types
export interface GanttDay {
  date: Date;
  dayOfMonth: number;
  dayOfWeek: string;
  isWeekend: boolean;
  isHoliday?: boolean;
  holidayName?: string;
}

export interface GanttMonth {
  name: string;
  year: number;
  days: GanttDay[];
}

// Calendar Filter Types
export type CalendarViewMode = 'day' | 'week' | 'month' | 'quarter' | 'year' | 'custom';

export interface CalendarFilter {
  viewMode: CalendarViewMode;
  selectedDate: Date;
  dateRange?: { start: Date; end: Date };
  statusFilter: ProjectStatus | 'todos';
}

// Colombian holidays (example)
export const HOLIDAYS_2024: { [key: string]: string } = {
  '2024-01-01': 'Año Nuevo',
  '2024-01-08': 'Día de los Reyes Magos',
  '2024-03-25': 'Día de San José',
  '2024-03-28': 'Jueves Santo',
  '2024-03-29': 'Viernes Santo',
  '2024-05-01': 'Día del Trabajo',
  '2024-05-13': 'Ascensión del Señor',
  '2024-06-03': 'Corpus Christi',
  '2024-06-10': 'Sagrado Corazón',
  '2024-07-01': 'San Pedro y San Pablo',
  '2024-07-20': 'Día de la Independencia',
  '2024-08-07': 'Batalla de Boyacá',
  '2024-08-19': 'La Asunción de la Virgen',
  '2024-10-14': 'Día de la Raza',
  '2024-11-04': 'Todos los Santos',
  '2024-11-11': 'Independencia de Cartagena',
  '2024-12-08': 'Día de la Inmaculada Concepción',
  '2024-12-25': 'Navidad',
};

export const HOLIDAYS_2025: { [key: string]: string } = {
  '2025-01-01': 'Año Nuevo',
  '2025-01-06': 'Día de los Reyes Magos',
  '2025-03-24': 'Día de San José',
  '2025-04-17': 'Jueves Santo',
  '2025-04-18': 'Viernes Santo',
  '2025-05-01': 'Día del Trabajo',
  '2025-06-02': 'Ascensión del Señor',
  '2025-06-23': 'Corpus Christi',
  '2025-06-30': 'Sagrado Corazón',
  '2025-07-20': 'Día de la Independencia',
  '2025-08-07': 'Batalla de Boyacá',
  '2025-08-18': 'La Asunción de la Virgen',
  '2025-10-13': 'Día de la Raza',
  '2025-11-03': 'Todos los Santos',
  '2025-11-17': 'Independencia de Cartagena',
  '2025-12-08': 'Día de la Inmaculada Concepción',
  '2025-12-25': 'Navidad',
};
