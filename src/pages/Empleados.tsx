import { useState } from "react";
import Layout from "@/components/Layout";
import { PanelHeader } from "@/components/PanelHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { MatrixTable } from "@/components/MatrixTable";
import { ColumnManagerDialog, ColumnConfig } from "@/components/ColumnManagerDialog";
import { EditableCell, CellType } from "@/components/EditableCell";
import { Plus, Trash2, Edit, Users, Search, Settings } from "lucide-react";
import { toast } from "sonner";
import { useUserRole } from "@/hooks/useUserRole";

export interface Empleado {
  id: string;
  categoria: "BBM" | "Proveedor" | "Transporte";
  nombre: string;
  telefono: string;
  correo: string;
  createdAt: string;
  [key: string]: any;
}

// Mock data for empleados
const initialEmpleados: Empleado[] = [
  { id: "e1", categoria: "BBM", nombre: "Juan Pérez", telefono: "+57 300 123 4567", correo: "juan.perez@bbm.com", createdAt: "2024-01-01T00:00:00Z" },
  { id: "e2", categoria: "BBM", nombre: "Laura Martínez", telefono: "+57 301 234 5678", correo: "laura.martinez@bbm.com", createdAt: "2024-01-05T00:00:00Z" },
  { id: "e3", categoria: "BBM", nombre: "Carlos Ruiz", telefono: "+57 302 345 6789", correo: "carlos.ruiz@bbm.com", createdAt: "2024-01-10T00:00:00Z" },
  { id: "e4", categoria: "Proveedor", nombre: "Diego Morales", telefono: "+57 303 456 7890", correo: "diego@proveedor.com", createdAt: "2024-01-15T00:00:00Z" },
  { id: "e5", categoria: "Transporte", nombre: "Andrés López", telefono: "+57 304 567 8901", correo: "andres@transporte.com", createdAt: "2024-01-20T00:00:00Z" },
];

// Export for use in other components
export const mockEmpleados = initialEmpleados;

export default function Empleados() {
  const { canEditStructure } = useUserRole();
  const [empleados, setEmpleados] = useState<Empleado[]>(initialEmpleados);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingEmpleado, setEditingEmpleado] = useState<Empleado | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [columnManagerOpen, setColumnManagerOpen] = useState(false);
  const [managedColumns, setManagedColumns] = useState<ColumnConfig[]>([]);
  
  const [formData, setFormData] = useState({
    categoria: "BBM" as "BBM" | "Proveedor" | "Transporte",
    nombre: "",
    telefono: "",
    correo: "",
  });

  const resetForm = () => {
    setFormData({ categoria: "BBM", nombre: "", telefono: "", correo: "" });
    setEditingEmpleado(null);
  };

  const handleSave = () => {
    if (!formData.nombre || !formData.categoria) {
      toast.error("Por favor complete los campos obligatorios (Categoría y Nombre)");
      return;
    }

    // Validate email format if provided
    if (formData.correo && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.correo)) {
      toast.error("El formato del correo electrónico no es válido");
      return;
    }

    if (editingEmpleado) {
      setEmpleados(empleados.map(e => 
        e.id === editingEmpleado.id 
          ? { ...e, ...formData }
          : e
      ));
      toast.success("Empleado actualizado exitosamente");
    } else {
      const newEmpleado: Empleado = {
        id: `e${Date.now()}`,
        ...formData,
        createdAt: new Date().toISOString(),
      };
      setEmpleados([...empleados, newEmpleado]);
      toast.success("Empleado agregado exitosamente");
    }

    setDialogOpen(false);
    resetForm();
  };

  const handleEdit = (empleado: Empleado) => {
    setEditingEmpleado(empleado);
    setFormData({
      categoria: empleado.categoria,
      nombre: empleado.nombre,
      telefono: empleado.telefono,
      correo: empleado.correo,
    });
    setDialogOpen(true);
  };

  const handleDelete = (empleadoId: string) => {
    setEmpleados(empleados.filter(e => e.id !== empleadoId));
    toast.success("Empleado eliminado");
  };

  const updateEmpleado = (empleadoId: string, field: string, value: any) => {
    setEmpleados(prev => prev.map(e => 
      e.id === empleadoId ? { ...e, [field]: value } : e
    ));
  };

  const filteredEmpleados = empleados.filter(e => 
    e.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
    e.correo.toLowerCase().includes(searchTerm.toLowerCase()) ||
    e.categoria.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const baseColumnDefs: ColumnConfig[] = [
    { key: "categoria", header: "Categoría", type: "select" as CellType, width: "120px", visible: true, isCustom: false, order: 0, options: ["BBM", "Proveedor", "Transporte"] },
    { key: "nombre", header: "Nombre", type: "text" as CellType, width: "200px", visible: true, isCustom: false, order: 1 },
    { key: "telefono", header: "Teléfono", type: "text" as CellType, width: "150px", visible: true, isCustom: false, order: 2 },
    { key: "correo", header: "Correo Electrónico", type: "text" as CellType, width: "220px", visible: true, isCustom: false, order: 3 },
    { key: "createdAt", header: "Fecha de Registro", type: "text" as CellType, width: "150px", visible: true, isCustom: false, order: 4 },
  ];

  const allColumnConfigs = managedColumns.length > 0 ? managedColumns : baseColumnDefs;

  const initializeColumns = () => {
    if (managedColumns.length === 0) {
      setManagedColumns(baseColumnDefs);
    }
    setColumnManagerOpen(true);
  };

  const getColumnRender = (col: ColumnConfig) => {
    return (e: Empleado) => {
      switch (col.key) {
        case "categoria":
          return (
            <div className="flex items-center gap-2">
              <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                e.categoria === "BBM" 
                  ? "bg-primary/10 text-primary" 
                  : e.categoria === "Proveedor"
                  ? "bg-amber-500/10 text-amber-600"
                  : "bg-blue-500/10 text-blue-600"
              }`}>
                {e.categoria}
              </span>
            </div>
          );
        case "nombre":
          return (
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                <Users className="w-4 h-4 text-primary" />
              </div>
              <EditableCell
                value={e.nombre}
                type="text"
                onChange={(value) => updateEmpleado(e.id, "nombre", value)}
              />
            </div>
          );
        case "telefono":
          return (
            <EditableCell
              value={e.telefono}
              type="text"
              onChange={(value) => updateEmpleado(e.id, "telefono", value)}
            />
          );
        case "correo":
          return (
            <EditableCell
              value={e.correo}
              type="text"
              onChange={(value) => updateEmpleado(e.id, "correo", value)}
            />
          );
        case "createdAt":
          return new Date(e.createdAt).toLocaleDateString('es-CO');
        default:
          // Custom columns
          const value = e[col.key];
          return (
            <EditableCell
              value={value}
              type={col.type || "text"}
              options={col.options}
              onChange={(newValue) => updateEmpleado(e.id, col.key, newValue)}
            />
          );
      }
    };
  };

  const columns = [
    ...allColumnConfigs
      .filter(col => col.visible !== false)
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
      .map(col => ({
        key: col.key,
        header: col.header,
        width: col.width,
        render: getColumnRender(col),
      })),
    { 
      key: "actions", 
      header: "Acciones", 
      width: "120px", 
      render: (e: Empleado) => (
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={(ev) => { ev.stopPropagation(); handleEdit(e); }}>
            <Edit className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={(ev) => { ev.stopPropagation(); handleDelete(e.id); }}>
            <Trash2 className="h-4 w-4 text-destructive" />
          </Button>
        </div>
      )
    },
  ];

  return (
    <Layout>
      <div className="space-y-6">
        <PanelHeader
          title="Creación de Empleados"
          description="Administrar empleados que pueden ser asignados a proyectos"
          actions={
            canEditStructure() && (
              <Button variant="outline" size="sm" onClick={initializeColumns}>
                <Settings className="h-4 w-4 mr-2" />
                Gestionar Columnas
              </Button>
            )
          }
        />

        <div className="flex items-center justify-between gap-4">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nombre, correo o categoría..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>

          <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) resetForm(); }}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Agregar Empleado
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{editingEmpleado ? "Editar Empleado" : "Agregar Nuevo Empleado"}</DialogTitle>
              </DialogHeader>
              
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="categoria">Categoría *</Label>
                  <Select
                    value={formData.categoria}
                    onValueChange={(value: "BBM" | "Proveedor" | "Transporte") => setFormData({ ...formData, categoria: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar categoría" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="BBM">BBM</SelectItem>
                      <SelectItem value="Proveedor">Proveedor</SelectItem>
                      <SelectItem value="Transporte">Transporte</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="nombre">Nombre *</Label>
                  <Input
                    id="nombre"
                    placeholder="Ej: Juan Pérez"
                    value={formData.nombre}
                    onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="telefono">Teléfono</Label>
                  <Input
                    id="telefono"
                    placeholder="Ej: +57 300 123 4567"
                    value={formData.telefono}
                    onChange={(e) => setFormData({ ...formData, telefono: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="correo">Correo Electrónico</Label>
                  <Input
                    id="correo"
                    type="email"
                    placeholder="Ej: empleado@empresa.com"
                    value={formData.correo}
                    onChange={(e) => setFormData({ ...formData, correo: e.target.value })}
                  />
                </div>
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => { setDialogOpen(false); resetForm(); }}>
                  Cancelar
                </Button>
                <Button onClick={handleSave}>
                  {editingEmpleado ? "Guardar Cambios" : "Agregar Empleado"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        <div className="panel-card">
          <div className="panel-header mb-0">
            <h3 className="text-sm font-semibold">Listado de Empleados</h3>
            <span className="text-xs text-muted-foreground">{filteredEmpleados.length} empleados registrados</span>
          </div>
          <MatrixTable data={filteredEmpleados} columns={columns} />
        </div>

        <div className="p-4 bg-muted/30 rounded-lg border border-border">
          <h4 className="text-sm font-medium mb-2">Nota Importante</h4>
          <p className="text-xs text-muted-foreground">
            Los empleados con categoría <strong>BBM</strong> son la fuente oficial de datos para el personal interno. 
            Cuando seleccione "Tipo = BBM" en el módulo de Personal de un evento, <strong>solo podrá seleccionar</strong> empleados 
            registrados aquí con categoría BBM. No es posible escribir nombres manualmente para personal BBM.
          </p>
        </div>

        <ColumnManagerDialog
          open={columnManagerOpen}
          onOpenChange={setColumnManagerOpen}
          columns={allColumnConfigs}
          onColumnsChange={setManagedColumns}
          panelName="Creación de Empleados"
        />
      </div>
    </Layout>
  );
}
