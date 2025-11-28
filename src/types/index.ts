// SSOT Types
export interface Project {
  id: string;
  centroCostos: string;
  numFactura: string;
  cliente: string;
  evento: string;
  fechaMontajeInicio: string;
  fechaMontajeFin: string;
  fechaEjecucionInicio: string;
  fechaEjecucionFin: string;
  estado: ProjectStatus;
  administrativoResponsable?: string;
  ingresos?: number;
  cotizaciones?: Attachment[];
  ordenesCompra?: Attachment[];
  ubicacion?: string;
  notas?: string;
  jefeOperaciones?: string;
  productor?: string;
  aCargoDe?: string;
  personal?: PersonalItem[];
  inventario?: InventarioItem[];
  cotizacionesProveedor?: Attachment[];
  createdAt: string;
  updatedAt: string;
}

export type ProjectStatus = 'activo' | 'pendiente' | 'completado' | 'cancelado';

export interface Attachment {
  id: string;
  name: string;
  url: string;
  type: string;
  uploadedAt: string;
}

export interface PersonalItem {
  id: string;
  nombre: string;
  cargo: string;
  telefono: string;
  notas?: string;
  extras?: string;
}

export interface InventarioItem {
  id: string;
  nombreMaterial: string;
  cantidad: number;
  unidad: string;
  observaciones?: string;
  recibido: boolean;
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
}

// Roles & Permissions
export type UserRole = 'administrador' | 'operativo' | 'visual';

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  avatar?: string;
}

// Field Constructor Types
export type FieldType = 'text' | 'number' | 'list' | 'file' | 'boolean' | 'date' | 'dateRange' | 'relation';

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
  options?: string[]; // For list type
  order: number;
}

// Gantt Types
export interface GanttDay {
  date: Date;
  dayOfMonth: number;
  dayOfWeek: string;
  isWeekend: boolean;
}

export interface GanttMonth {
  name: string;
  year: number;
  days: GanttDay[];
}
