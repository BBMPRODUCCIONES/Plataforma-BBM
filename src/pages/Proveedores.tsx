import { useState } from "react";
import Layout from "@/components/Layout";
import { PanelHeader } from "@/components/PanelHeader";
import { MatrixTable } from "@/components/MatrixTable";
import { useProveedores } from "@/contexts/ProveedoresContext";
import { Proveedor, Attachment } from "@/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Search, Plus, Phone, Mail, FileText, Tag, Columns, Loader2 } from "lucide-react";
import { ColumnManagerDialog, ColumnConfig } from "@/components/ColumnManagerDialog";
import { usePersistedColumns } from "@/hooks/usePersistedColumns";
import { EditableCell } from "@/components/EditableCell";
import { useUserRole } from "@/hooks/useUserRole";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { CotizacionesDialog } from "@/components/CotizacionesDialog";

const baseColumnDefs = [
  { key: "categoria", header: "CATEGORÍA", width: "120px", type: "text" as const },
  { key: "nombre", header: "NOMBRE", width: "180px", type: "text" as const },
  { key: "telefono", header: "TELÉFONO", width: "140px", type: "text" as const },
  { key: "correo", header: "CORREO", width: "200px", type: "text" as const },
  { key: "tipoProductoServicio", header: "TIPO DE PRODUCTO O SERVICIO", width: "250px", type: "text" as const },
  { key: "cotizaciones", header: "COTIZACIONES", width: "120px", type: "file" as const },
  { key: "notas", header: "NOTAS", width: "200px", type: "text" as const },
];

const Proveedores = () => {
  const { proveedores, loading, addProveedor, updateProveedor } = useProveedores();
  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("todas");
  const [selectedProveedor, setSelectedProveedor] = useState<Proveedor | null>(null);
  const [columnManagerOpen, setColumnManagerOpen] = useState(false);
  const [newProveedorOpen, setNewProveedorOpen] = useState(false);
  const [cotizacionesProveedor, setCotizacionesProveedor] = useState<Proveedor | null>(null);
  const [saving, setSaving] = useState(false);
  const [newProveedor, setNewProveedor] = useState({
    categoria: "",
    nombre: "",
    telefono: "",
    correo: "",
    tipoProductoServicio: "",
    notas: "",
  });
  const { role } = useUserRole();
  const isAdmin = role?.toLowerCase() === "administrador";

  // Initialize managed columns from base definitions - persisted
  const defaultColumns: ColumnConfig[] = baseColumnDefs.map((col, index) => ({
    key: col.key,
    header: col.header,
    type: col.type,
    width: col.width,
    visible: true,
    isCustom: false,
    order: index,
  }));
  const [managedColumns, setManagedColumns] = usePersistedColumns("proveedores-columns", defaultColumns);

  // Handle column changes - force new array reference
  const handleColumnsChange = (newColumns: ColumnConfig[]) => {
    console.log('[Proveedores] Received column changes:', newColumns.length, newColumns);
    const copiedColumns = newColumns.map(col => ({ ...col }));
    setManagedColumns(copiedColumns);
  };

  const categories = [...new Set(proveedores.map((p) => p.categoria).filter(Boolean))];

  const filteredProveedores = proveedores.filter((p) => {
    const matchesSearch =
      p.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.tipoProductoServicio.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = categoryFilter === "todas" || p.categoria === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  const handleUpdateProveedor = async (id: string, field: string, value: any) => {
    try {
      await updateProveedor(id, field, value);
    } catch (err) {
      toast.error("Error al actualizar proveedor");
    }
  };

  const handleCreateProveedor = async () => {
    if (!newProveedor.nombre.trim()) {
      toast.error("El nombre es requerido");
      return;
    }

    setSaving(true);
    try {
      await addProveedor({
        ...newProveedor,
        cotizacionesAnteriores: [],
      });
      toast.success("Proveedor creado exitosamente");
      setNewProveedorOpen(false);
      setNewProveedor({
        categoria: "",
        nombre: "",
        telefono: "",
        correo: "",
        tipoProductoServicio: "",
        notas: "",
      });
    } catch (err) {
      console.error('[Proveedores] Error creating proveedor:', err);
      toast.error("Error al crear proveedor");
    } finally {
      setSaving(false);
    }
  };

  // Build columns dynamically from managed columns
  const visibleColumns = managedColumns
    .filter((col) => col.visible)
    .sort((a, b) => a.order - b.order);

  // Generate a unique key for the table to force re-renders when columns change
  const tableKey = `table-${managedColumns.map(c => `${c.key}-${c.visible}-${c.order}`).join('_')}`;

  const columns = visibleColumns.map((colConfig) => {
    // Special rendering for base columns
    if (colConfig.key === "categoria" && !colConfig.isCustom) {
      return {
        key: colConfig.key,
        header: colConfig.header,
        width: colConfig.width,
        render: (p: Proveedor) => (
          <EditableCell
            value={p.categoria || ""}
            type="text"
            onChange={(value) => handleUpdateProveedor(p.id, "categoria", value)}
          />
        ),
      };
    }

    if (colConfig.key === "nombre" && !colConfig.isCustom) {
      return {
        key: colConfig.key,
        header: colConfig.header,
        width: colConfig.width,
        render: (p: Proveedor) => (
          <EditableCell
            value={p.nombre || ""}
            type="text"
            onChange={(value) => handleUpdateProveedor(p.id, "nombre", value)}
          />
        ),
      };
    }

    if (colConfig.key === "telefono" && !colConfig.isCustom) {
      return {
        key: colConfig.key,
        header: colConfig.header,
        width: colConfig.width,
        render: (p: Proveedor) => (
          <div className="flex items-center gap-2 text-xs">
            <Phone className="h-3 w-3 text-muted-foreground shrink-0" />
            <EditableCell
              value={p.telefono || ""}
              type="text"
              onChange={(value) => handleUpdateProveedor(p.id, "telefono", value)}
            />
          </div>
        ),
      };
    }

    if (colConfig.key === "correo" && !colConfig.isCustom) {
      return {
        key: colConfig.key,
        header: colConfig.header,
        width: colConfig.width,
        render: (p: Proveedor) => (
          <div className="flex items-center gap-2 text-xs">
            <Mail className="h-3 w-3 text-muted-foreground shrink-0" />
            <EditableCell
              value={p.correo || ""}
              type="text"
              onChange={(value) => handleUpdateProveedor(p.id, "correo", value)}
            />
          </div>
        ),
      };
    }

    if (colConfig.key === "tipoProductoServicio" && !colConfig.isCustom) {
      return {
        key: colConfig.key,
        header: colConfig.header,
        width: colConfig.width,
        render: (p: Proveedor) => (
          <EditableCell
            value={p.tipoProductoServicio || ""}
            type="text"
            onChange={(value) => handleUpdateProveedor(p.id, "tipoProductoServicio", value)}
          />
        ),
      };
    }

    if (colConfig.key === "cotizaciones" && !colConfig.isCustom) {
      return {
        key: colConfig.key,
        header: colConfig.header,
        width: colConfig.width,
        render: (p: Proveedor) => (
          <Button 
            variant="ghost" 
            size="sm" 
            className="h-7 px-2 text-xs"
            onClick={(e) => {
              e.stopPropagation();
              setCotizacionesProveedor(p);
            }}
          >
            <FileText className="h-3 w-3 mr-1" />
            {p.cotizacionesAnteriores?.length || 0} archivos
          </Button>
        ),
      };
    }

    if (colConfig.key === "notas" && !colConfig.isCustom) {
      return {
        key: colConfig.key,
        header: colConfig.header,
        width: colConfig.width,
        render: (p: Proveedor) => (
          <EditableCell
            value={p.notas || ""}
            type="text"
            onChange={(value) => handleUpdateProveedor(p.id, "notas", value)}
          />
        ),
      };
    }

    // Custom columns - use EditableCell
    return {
      key: colConfig.key,
      header: colConfig.header,
      width: colConfig.width,
      render: (p: Proveedor) => (
        <EditableCell
          value={(p as any)[colConfig.key] || ""}
          type={colConfig.type}
          options={colConfig.options}
          onChange={(value) => handleUpdateProveedor(p.id, colConfig.key, value)}
        />
      ),
    };
  });

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
          title="Panel de Proveedores"
          description="Gestión de proveedores y cotizaciones"
          panelLinks={[
            { label: "Directivo", to: "/panel-directivo" },
            { label: "General", to: "/panel-general" },
            { label: "Operaciones", to: "/panel-operaciones" },
          ]}
          actions={
            <div className="flex items-center gap-2">
              {isAdmin && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setColumnManagerOpen(true)}
                >
                  <Columns className="h-4 w-4 mr-2" />
                  Gestionar Columnas
                </Button>
              )}
              <Button size="sm" onClick={() => setNewProveedorOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Nuevo Proveedor
              </Button>
            </div>
          }
        />

        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-3">
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-40 h-9">
                <SelectValue placeholder="Categoría" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todas">Todas las categorías</SelectItem>
                {categories.map((cat) => (
                  <SelectItem key={cat} value={cat}>
                    {cat}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="relative w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar proveedor..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 h-9"
            />
          </div>
        </div>

        {/* Matrix Table */}
        <div className="panel-card">
          <MatrixTable
            key={tableKey}
            data={filteredProveedores}
            columns={columns}
            onRowClick={(p) => setSelectedProveedor(p)}
          />
        </div>

        {/* Summary Cards */}
        {categories.length > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {categories.map((cat) => {
              const count = proveedores.filter((p) => p.categoria === cat).length;
              return (
                <Card
                  key={cat}
                  className="cursor-pointer hover:border-primary/50 transition-colors"
                  onClick={() => setCategoryFilter(cat)}
                >
                  <CardHeader className="pb-2">
                    <CardTitle className="text-xs text-muted-foreground">{cat}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <span className="text-2xl font-bold">{count}</span>
                    <span className="text-xs text-muted-foreground ml-2">proveedores</span>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        {/* New Proveedor Dialog */}
        <Dialog open={newProveedorOpen} onOpenChange={setNewProveedorOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Nuevo Proveedor</DialogTitle>
            </DialogHeader>

            <div className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label>Nombre *</Label>
                <Input
                  value={newProveedor.nombre}
                  onChange={(e) => setNewProveedor(prev => ({ ...prev, nombre: e.target.value }))}
                  placeholder="Nombre del proveedor"
                />
              </div>

              <div className="space-y-2">
                <Label>Categoría</Label>
                <Input
                  value={newProveedor.categoria}
                  onChange={(e) => setNewProveedor(prev => ({ ...prev, categoria: e.target.value }))}
                  placeholder="Ej: Transporte, Equipos, Catering..."
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Teléfono</Label>
                  <Input
                    value={newProveedor.telefono}
                    onChange={(e) => setNewProveedor(prev => ({ ...prev, telefono: e.target.value }))}
                    placeholder="Teléfono"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Correo</Label>
                  <Input
                    type="email"
                    value={newProveedor.correo}
                    onChange={(e) => setNewProveedor(prev => ({ ...prev, correo: e.target.value }))}
                    placeholder="correo@ejemplo.com"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Tipo de Producto o Servicio</Label>
                <Input
                  value={newProveedor.tipoProductoServicio}
                  onChange={(e) => setNewProveedor(prev => ({ ...prev, tipoProductoServicio: e.target.value }))}
                  placeholder="Descripción del producto/servicio"
                />
              </div>

              <div className="space-y-2">
                <Label>Notas</Label>
                <Input
                  value={newProveedor.notas}
                  onChange={(e) => setNewProveedor(prev => ({ ...prev, notas: e.target.value }))}
                  placeholder="Notas adicionales"
                />
              </div>
            </div>

            <DialogFooter className="mt-6">
              <Button variant="outline" onClick={() => setNewProveedorOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={handleCreateProveedor} disabled={saving}>
                {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Guardar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Proveedor Detail Dialog */}
        <Dialog open={!!selectedProveedor} onOpenChange={() => setSelectedProveedor(null)}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>{selectedProveedor?.nombre}</DialogTitle>
            </DialogHeader>

            {selectedProveedor && (
              <div className="space-y-4 mt-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <span className="text-xs text-muted-foreground">Categoría</span>
                    <p className="text-sm font-medium">{selectedProveedor.categoria || "-"}</p>
                  </div>
                  <div>
                    <span className="text-xs text-muted-foreground">Tipo</span>
                    <p className="text-sm">{selectedProveedor.tipoProductoServicio || "-"}</p>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Phone className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">{selectedProveedor.telefono || "-"}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Mail className="h-4 w-4 text-muted-foreground" />
                    {selectedProveedor.correo ? (
                      <a href={`mailto:${selectedProveedor.correo}`} className="text-sm text-primary hover:underline">
                        {selectedProveedor.correo}
                      </a>
                    ) : (
                      <span className="text-sm">-</span>
                    )}
                  </div>
                </div>

                {selectedProveedor.notas && (
                  <div>
                    <span className="text-xs text-muted-foreground">Notas</span>
                    <p className="text-sm mt-1">{selectedProveedor.notas}</p>
                  </div>
                )}

                <div>
                  <span className="text-xs text-muted-foreground">Cotizaciones Anteriores</span>
                  <p className="text-sm text-muted-foreground mt-1">
                    {selectedProveedor.cotizacionesAnteriores?.length || 0} archivos adjuntos
                  </p>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Column Manager Dialog */}
        <ColumnManagerDialog
          open={columnManagerOpen}
          onOpenChange={setColumnManagerOpen}
          columns={managedColumns}
          onColumnsChange={handleColumnsChange}
          panelName="Proveedores"
        />

        {/* Cotizaciones Dialog */}
        {cotizacionesProveedor && (
          <CotizacionesDialog
            open={!!cotizacionesProveedor}
            onOpenChange={(open) => !open && setCotizacionesProveedor(null)}
            proveedorId={cotizacionesProveedor.id}
            proveedorNombre={cotizacionesProveedor.nombre}
            cotizaciones={cotizacionesProveedor.cotizacionesAnteriores || []}
            onCotizacionesChange={(cotizaciones) => {
              handleUpdateProveedor(cotizacionesProveedor.id, 'cotizacionesAnteriores', cotizaciones);
              setCotizacionesProveedor(prev => prev ? { ...prev, cotizacionesAnteriores: cotizaciones } : null);
            }}
          />
        )}
      </div>
    </Layout>
  );
};

export default Proveedores;
