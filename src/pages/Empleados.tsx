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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ColumnManagerDialog, ColumnConfig } from "@/components/ColumnManagerDialog";
import { usePersistedColumns } from "@/hooks/usePersistedColumns";
import { EditableCell, CellType } from "@/components/EditableCell";
import { BancoAutocomplete } from "@/components/BancoAutocomplete";
import { Plus, Trash2, Edit, Users, Search, Settings, Loader2, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { useUserRole } from "@/hooks/useUserRole";
import { useEmpleados, Empleado } from "@/contexts/EmpleadosContext";
import { Navigate } from "react-router-dom";

export default function Empleados() {
  const { canEditStructure, role } = useUserRole();
  const isAdmin = role?.toLowerCase() === "administrador";
  const { empleados, loading, addEmpleado, updateEmpleado, deleteEmpleado } = useEmpleados();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingEmpleado, setEditingEmpleado] = useState<Empleado | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [columnManagerOpen, setColumnManagerOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  // SECURITY: Only admin can access this page
  // This page displays sensitive contact information (telefono, correo)
  if (!isAdmin) {
    return <Navigate to="/general" replace />;
  }

  // Initialize with base columns - persisted
  const defaultColumns: ColumnConfig[] = [
    { key: "cargo", header: "CARGO", type: "text" as CellType, width: "150px", visible: true, isCustom: false, order: 0 },
    { key: "nombre", header: "NOMBRE", type: "text" as CellType, width: "200px", visible: true, isCustom: false, order: 1 },
    { key: "telefono", header: "TELÉFONO", type: "text" as CellType, width: "150px", visible: true, isCustom: false, order: 2 },
    { key: "correo", header: "CORREO", type: "text" as CellType, width: "200px", visible: true, isCustom: false, order: 3 },
    { key: "acciones", header: "ACCIONES", type: "text" as CellType, width: "120px", visible: true, isCustom: false, order: 4 },
  ];
  const [managedColumns, setManagedColumns] = usePersistedColumns("empleados-columns", defaultColumns);

  const handleColumnsChange = (newColumns: ColumnConfig[]) => {
    console.log('[Empleados] Received column changes:', newColumns.length, newColumns);
    const copiedColumns = newColumns.map(col => ({ ...col }));
    setManagedColumns(copiedColumns);
  };
  
  const [formData, setFormData] = useState({
    cargo: "",
    nombre: "",
    telefono: "",
    correo: "",
    banco: "",
    tipoCuenta: "",
    numeroCuenta: "",
  });

  const resetForm = () => {
    setFormData({ cargo: "", nombre: "", telefono: "", correo: "", banco: "", tipoCuenta: "", numeroCuenta: "" });
    setEditingEmpleado(null);
  };

  const handleSave = async () => {
    if (!formData.nombre) {
      toast.error("Por favor complete el campo Nombre");
      return;
    }

    // Validate email format if provided
    if (formData.correo && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.correo)) {
      toast.error("El formato del correo electrónico no es válido");
      return;
    }

    setSaving(true);
    try {
      if (editingEmpleado) {
        await updateEmpleado(editingEmpleado.id, formData);
        toast.success("Empleado actualizado exitosamente");
      } else {
        const result = await addEmpleado(formData);
        if (result) {
          toast.success("Empleado agregado exitosamente");
        }
      }

      setDialogOpen(false);
      resetForm();
    } catch (err) {
      console.error("Error saving employee:", err);
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (empleado: Empleado) => {
    setEditingEmpleado(empleado);
    setFormData({
      cargo: empleado.cargo || "",
      nombre: empleado.nombre,
      telefono: empleado.telefono,
      correo: empleado.correo,
      banco: empleado.banco || "",
      tipoCuenta: empleado.tipoCuenta || "",
      numeroCuenta: empleado.numeroCuenta || "",
    });
    setDialogOpen(true);
  };

  const handleDelete = async (empleadoId: string) => {
    await deleteEmpleado(empleadoId);
    toast.success("Empleado eliminado");
  };

  const handleUpdateEmpleado = async (empleadoId: string, field: string, value: any) => {
    await updateEmpleado(empleadoId, { [field]: value });
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

  const getColumnRender = (col: ColumnConfig, e: Empleado) => {
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

  const visibleColumns = allColumnConfigs
    .filter(col => col.visible !== false)
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-6">
        <PanelHeader
          title="Creación de Empleados"
          description="Administrar empleados que pueden ser asignados a proyectos"
          actions={
            isAdmin && (
              <Button variant="outline" size="sm" onClick={initializeColumns}>
                <Settings className="h-4 w-4 mr-2" />
                Gestionar Columnas
              </Button>
            )
          }
        />

        {/* Security Notice */}
        <div className="flex items-center gap-2 p-3 bg-primary/10 rounded-lg border border-primary/20">
          <ShieldAlert className="h-4 w-4 text-primary" />
          <span className="text-xs text-muted-foreground">
            Esta página contiene información de contacto sensible y solo es accesible para administradores.
          </span>
        </div>

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
              
              <div className="space-y-6 py-4">
                <div className="space-y-4">
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

                {/* DATOS BANCARIOS Section */}
                <div className="space-y-3 pt-2 border-t border-border">
                  <h4 className="text-sm font-semibold text-foreground">DATOS BANCARIOS</h4>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="space-y-2">
                      <Label htmlFor="banco" className="text-xs">BANCO</Label>
                      <BancoAutocomplete
                        value={formData.banco}
                        onChange={(value) => setFormData({ ...formData, banco: value })}
                        placeholder="Buscar banco..."
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="tipoCuenta" className="text-xs">CUENTA</Label>
                      <Select 
                        value={formData.tipoCuenta} 
                        onValueChange={(value) => setFormData({ ...formData, tipoCuenta: value })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Seleccionar..." />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Ahorros">Ahorros</SelectItem>
                          <SelectItem value="Corriente">Corriente</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="numeroCuenta" className="text-xs"># DE CUENTA</Label>
                      <Input
                        id="numeroCuenta"
                        placeholder="Ej: 1234567890"
                        value={formData.numeroCuenta}
                        onChange={(e) => setFormData({ ...formData, numeroCuenta: e.target.value })}
                      />
                    </div>
                  </div>
                </div>
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => { setDialogOpen(false); resetForm(); }}>
                  Cancelar
                </Button>
                <Button onClick={handleSave} disabled={saving}>
                  {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
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
          <div className="overflow-x-auto scrollbar-thin">
            <Table>
              <TableHeader>
                {/* First row with grouped header */}
                <TableRow className="border-b-0">
                  {visibleColumns.map(col => (
                    <TableHead 
                      key={col.key} 
                      rowSpan={2} 
                      className="border-r border-border/50 text-center align-middle"
                      style={{ width: col.width, minWidth: col.width }}
                    >
                      {col.header}
                    </TableHead>
                  ))}
                  <TableHead 
                    colSpan={3} 
                    className="text-center border-b border-border/50 bg-primary/5 font-bold"
                  >
                    DATOS BANCARIOS
                  </TableHead>
                  <TableHead rowSpan={2} className="text-center align-middle" style={{ width: "120px" }}>
                    Acciones
                  </TableHead>
                </TableRow>
                {/* Second row with banking sub-columns */}
                <TableRow>
                  <TableHead className="text-center border-r border-border/50 bg-primary/5" style={{ width: "150px", minWidth: "150px" }}>
                    BANCO
                  </TableHead>
                  <TableHead className="text-center border-r border-border/50 bg-primary/5" style={{ width: "120px", minWidth: "120px" }}>
                    CUENTA
                  </TableHead>
                  <TableHead className="text-center bg-primary/5" style={{ width: "150px", minWidth: "150px" }}>
                    # DE CUENTA
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredEmpleados.map((empleado) => (
                  <TableRow key={empleado.id}>
                    {visibleColumns.map(col => (
                      <TableCell key={col.key} className="border-r border-border/30">
                        {getColumnRender(col, empleado)}
                      </TableCell>
                    ))}
                    {/* Banking columns */}
                    <TableCell className="border-r border-border/30">
                      <BancoAutocomplete
                        value={empleado.banco || ""}
                        onChange={(value) => handleUpdateEmpleado(empleado.id, "banco", value)}
                        placeholder="Buscar banco..."
                      />
                    </TableCell>
                    <TableCell className="border-r border-border/30">
                      <EditableCell
                        value={empleado.tipoCuenta || ""}
                        type="select"
                        options={["Ahorros", "Corriente"]}
                        placeholder="Seleccionar"
                        onChange={(value) => handleUpdateEmpleado(empleado.id, "tipoCuenta", value)}
                      />
                    </TableCell>
                    <TableCell className="border-r border-border/30">
                      <EditableCell
                        value={empleado.numeroCuenta || ""}
                        type="text"
                        placeholder="Ej: 1234567890"
                        onChange={(value) => handleUpdateEmpleado(empleado.id, "numeroCuenta", value)}
                      />
                    </TableCell>
                    {/* Actions column */}
                    <TableCell>
                      <div className="flex items-center justify-center gap-2">
                        <Button variant="ghost" size="icon" onClick={() => handleEdit(empleado)}>
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => handleDelete(empleado.id)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
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
          onColumnsChange={handleColumnsChange}
          panelName="Creación de Empleados"
        />
      </div>
    </Layout>
  );
}
