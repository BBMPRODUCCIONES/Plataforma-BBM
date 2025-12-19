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
import { useClientes } from "@/contexts/ClientesContext";
import { Cliente } from "@/types";
import { MatrixTable } from "@/components/MatrixTable";
import { Plus, Trash2, Edit, Building2, Search, Loader2 } from "lucide-react";
import { toast } from "sonner";

export default function Clientes() {
  const { clientes, loading, addCliente, updateCliente, deleteCliente } = useClientes();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingCliente, setEditingCliente] = useState<Cliente | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [saving, setSaving] = useState(false);
  
  const [formData, setFormData] = useState({
    nombre: "",
    nit: "",
  });

  const resetForm = () => {
    setFormData({ nombre: "", nit: "" });
    setEditingCliente(null);
  };

  const handleSave = async () => {
    if (!formData.nombre || !formData.nit) {
      toast.error("Por favor complete todos los campos");
      return;
    }

    // Validate NIT format
    if (!/^[\d-]+$/.test(formData.nit)) {
      toast.error("El NIT solo debe contener números y guiones");
      return;
    }

    // Check for duplicate NIT
    const existingNit = clientes.find(c => c.nit === formData.nit && c.id !== editingCliente?.id);
    if (existingNit) {
      toast.error("Ya existe un cliente con ese NIT");
      return;
    }

    setSaving(true);
    try {
      if (editingCliente) {
        await updateCliente(editingCliente.id, {
          nombre: formData.nombre,
          nit: formData.nit,
        });
        toast.success("Cliente actualizado exitosamente");
      } else {
        const result = await addCliente({
          nombre: formData.nombre,
          nit: formData.nit,
        });
        if (result) {
          toast.success("Cliente agregado exitosamente");
        }
      }

      setDialogOpen(false);
      resetForm();
    } catch (err) {
      console.error("Error saving client:", err);
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (cliente: Cliente) => {
    setEditingCliente(cliente);
    setFormData({
      nombre: cliente.nombre,
      nit: cliente.nit,
    });
    setDialogOpen(true);
  };

  const handleDelete = async (clienteId: string) => {
    await deleteCliente(clienteId);
    toast.success("Cliente eliminado");
  };

  const filteredClientes = clientes.filter(c => 
    c.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.nit.includes(searchTerm)
  );

  const columns = [
    { 
      key: "nombre", 
      header: "Nombre del Cliente", 
      width: "350px", 
      render: (c: Cliente) => (
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
            <Building2 className="w-4 h-4 text-primary" />
          </div>
          <span className="font-medium">{c.nombre}</span>
        </div>
      )
    },
    { key: "nit", header: "NIT", width: "200px" },
    { 
      key: "createdAt", 
      header: "Fecha de Registro", 
      width: "200px",
      render: (c: Cliente) => new Date(c.createdAt).toLocaleDateString('es-CO')
    },
    { 
      key: "actions", 
      header: "Acciones", 
      width: "120px", 
      render: (c: Cliente) => (
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); handleEdit(c); }}>
            <Edit className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); handleDelete(c.id); }}>
            <Trash2 className="h-4 w-4 text-destructive" />
          </Button>
        </div>
      )
    },
  ];

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
          title="Gestión de Clientes"
          description="Administrar clientes que pueden ser asignados a proyectos"
        />

        <div className="flex items-center justify-between gap-4">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nombre o NIT..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>

          <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) resetForm(); }}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Agregar Cliente
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{editingCliente ? "Editar Cliente" : "Agregar Nuevo Cliente"}</DialogTitle>
              </DialogHeader>
              
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="nombre">Nombre del Cliente *</Label>
                  <Input
                    id="nombre"
                    placeholder="Ej: Corporación ABC S.A.S."
                    value={formData.nombre}
                    onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="nit">NIT del Cliente *</Label>
                  <Input
                    id="nit"
                    placeholder="Ej: 900123456-1"
                    value={formData.nit}
                    onChange={(e) => setFormData({ ...formData, nit: e.target.value })}
                  />
                  <p className="text-xs text-muted-foreground">
                    Ingrese el NIT incluyendo el dígito de verificación (ej: 900123456-1)
                  </p>
                </div>
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => { setDialogOpen(false); resetForm(); }}>
                  Cancelar
                </Button>
                <Button onClick={handleSave} disabled={saving}>
                  {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  {editingCliente ? "Guardar Cambios" : "Agregar Cliente"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        <div className="panel-card">
          <div className="panel-header mb-0">
            <h3 className="text-sm font-semibold">Listado de Clientes</h3>
            <span className="text-xs text-muted-foreground">{filteredClientes.length} clientes registrados</span>
          </div>
          <MatrixTable 
            data={filteredClientes} 
            columns={columns}
          />
        </div>

        <div className="p-4 bg-muted/30 rounded-lg border border-border">
          <h4 className="text-sm font-medium mb-2">Nota Importante</h4>
          <p className="text-xs text-muted-foreground">
            Solo los clientes registrados aquí pueden ser seleccionados al crear o editar proyectos en cualquier panel (Directivo, General, Operaciones). 
            No es posible crear clientes desde otros paneles.
          </p>
        </div>
      </div>
    </Layout>
  );
}
