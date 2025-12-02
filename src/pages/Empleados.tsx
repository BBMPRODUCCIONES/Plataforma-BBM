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
  DialogDescription,
} from "@/components/ui/dialog";
import { MatrixTable } from "@/components/MatrixTable";
import { ColumnManagerDialog, ColumnConfig } from "@/components/ColumnManagerDialog";
import { EditableCell, CellType } from "@/components/EditableCell";
import { Plus, Trash2, Edit, Users, Search, Settings } from "lucide-react";
import { toast } from "sonner";
import { useUserRole } from "@/hooks/useUserRole";
import { useEmpleados, Empleado } from "@/contexts/EmpleadosContext";

export default function Empleados() {
  const { canEditStructure } = useUserRole();
  const { empleados, addEmpleado, updateEmpleado, deleteEmpleado } = useEmpleados();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingEmpleado, setEditingEmpleado] = useState<Empleado | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [columnManagerOpen, setColumnManagerOpen] = useState(false);
  const [managedColumns, setManagedColumns] = useState<ColumnConfig[]>([]);
  
  const [formData, setFormData] = useState({
    cargo: "",
    nombre: "",
    telefono: "",
    correo: "",
  });

  const resetForm = () => {
    setFormData({ cargo: "", nombre: "", telefono: "", correo: "" });
    setEditingEmpleado(null);
  };

  const handleSave = () => {
    if (!formData.nombre) {
      toast.error("Por favor complete el campo Nombre");
      return;
    }

    // Validate email format if provided
    if (formData.correo && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.correo)) {
      toast.error("El formato del correo electrónico no es válido");
      return;
    }

    if (editingEmpleado) {
      updateEmpleado(editingEmpleado.id, formData);
      toast.success("Empleado actualizado exitosamente");
    } else {
      const newEmpleado: Empleado = {
        id: `e${Date.now()}`,
        ...formData,
        createdAt: new Date().toISOString(),
      };
      addEmpleado(newEmpleado);
      toast.success("Empleado agregado exitosamente");
    }

    setDialogOpen(false);
    resetForm();
  };

  const handleEdit = (empleado: Empleado) => {
    setEditingEmpleado(empleado);
    setFormData({
      cargo: empleado.cargo || "",
      nombre: empleado.nombre,
      telefono: empleado.telefono,
      correo: empleado.correo,
    });
    setDialogOpen(true);
  };

  const handleDelete = (empleadoId: string) => {
    deleteEmpleado(empleadoId);
    toast.success("Empleado eliminado");
  };

  const handleUpdateEmpleado = (empleadoId: string, field: string, value: any) => {
    updateEmpleado(empleadoId, { [field]: value });
  };

  const filteredEmpleados = empleados.filter(e => 
    e.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
    e.correo.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (e.cargo && e.cargo.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const baseColumnDefs: ColumnConfig[] = [
    { key: "cargo", header: "Cargo", type: "text" as CellType, width: "180px", visible: true, isCustom: false, order: 0 },
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
        case "cargo":
          return (
            <EditableCell
              value={e.cargo || ""}
              type="text"
              onChange={(value) => handleUpdateEmpleado(e.id, "cargo", value)}
            />
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
                onChange={(value) => handleUpdateEmpleado(e.id, "nombre", value)}
              />
            </div>
          );
        case "telefono":
          return (
            <EditableCell
              value={e.telefono}
              type="text"
              onChange={(value) => handleUpdateEmpleado(e.id, "telefono", value)}
            />
          );
        case "correo":
          return (
            <EditableCell
              value={e.correo}
              type="text"
              onChange={(value) => handleUpdateEmpleado(e.id, "correo", value)}
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
              onChange={(newValue) => handleUpdateEmpleado(e.id, col.key, newValue)}
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
              placeholder="Buscar por nombre, correo o cargo..."
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
                <DialogDescription>
                  Complete los datos del empleado. Los empleados creados aquí estarán disponibles para selección en eventos.
                </DialogDescription>
              </DialogHeader>
              
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="cargo">Cargo</Label>
                  <Input
                    id="cargo"
                    placeholder="Ej: Coordinador de Logística"
                    value={formData.cargo}
                    onChange={(e) => setFormData({ ...formData, cargo: e.target.value })}
                  />
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
            Los empleados creados aquí son la fuente oficial de datos para el personal interno. 
            Cuando seleccione "Tipo = BBM" en el módulo de Personal de un evento, <strong>solo podrá seleccionar</strong> empleados 
            registrados en este módulo. No es posible escribir nombres manualmente para personal BBM.
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
