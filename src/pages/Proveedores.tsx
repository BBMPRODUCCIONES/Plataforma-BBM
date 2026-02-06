import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { logger } from "@/lib/logger";
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
import { Search, Plus, Phone, Mail, FileText, Tag, Columns, Loader2, History, FileImage } from "lucide-react";
import { ColumnManagerDialog, ColumnConfig } from "@/components/ColumnManagerDialog";
import { useGlobalColumns } from "@/hooks/useGlobalColumns";
import { EditableCell } from "@/components/EditableCell";
import { useUserRole } from "@/hooks/useUserRole";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { CotizacionesDialog } from "@/components/CotizacionesDialog";
import { BancoAutocomplete } from "@/components/BancoAutocomplete";
import { CertificadoBancarioUpload } from "@/components/CertificadoBancarioUpload";

const baseColumnDefs = [
  { key: "categoria", header: "CATEGORÍA", width: "120px", type: "text" as const },
  { key: "nombre", header: "NOMBRE", width: "180px", type: "text" as const },
  { key: "telefono", header: "TELÉFONO", width: "140px", type: "text" as const },
  { key: "correo", header: "CORREO", width: "200px", type: "text" as const },
  { key: "tipoProductoServicio", header: "TIPO DE PRODUCTO O SERVICIO", width: "250px", type: "text" as const },
  { key: "datosBancarios", header: "DATOS BANCARIOS", width: "320px", type: "text" as const },
  { key: "certificadoBancario", header: "CERT. BANCARIO", width: "130px", type: "file" as const },
  { key: "cotizaciones", header: "COTIZACIONES", width: "120px", type: "file" as const },
  { key: "notas", header: "NOTAS", width: "200px", type: "text" as const },
];

const Proveedores = () => {
  const navigate = useNavigate();
  const { proveedores, loading, addProveedor, updateProveedor } = useProveedores();
  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("todas");
  const [selectedProveedor, setSelectedProveedor] = useState<Proveedor | null>(null);
  const [columnManagerOpen, setColumnManagerOpen] = useState(false);
  const [newProveedorOpen, setNewProveedorOpen] = useState(false);
  const [cotizacionesProveedor, setCotizacionesProveedor] = useState<Proveedor | null>(null);
  const [saving, setSaving] = useState(false);
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const [newProveedor, setNewProveedor] = useState({
    categoria: "",
    nombre: "",
    telefono: "",
    correo: "",
    tipoProductoServicio: "",
    notas: "",
    banco: "",
    tipoCuenta: "",
    numeroCuenta: "",
  });
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
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
  const { columns: managedColumns, setColumns: setManagedColumns, isAdmin: canModifyStructure } = useGlobalColumns("proveedores", defaultColumns);

  // Handle column changes - force new array reference
  const handleColumnsChange = (newColumns: ColumnConfig[]) => {
    logger.debug('[Proveedores] Received column changes:', newColumns.length, newColumns);
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

  const validateNewProveedor = () => {
    const errors: Record<string, string> = {};
    
    if (!newProveedor.categoria.trim()) {
      errors.categoria = "Campo obligatorio";
    }
    if (!newProveedor.nombre.trim()) {
      errors.nombre = "Campo obligatorio";
    }
    
    // Validar teléfono: exactamente 10 dígitos
    const telefonoDigits = newProveedor.telefono.replace(/\D/g, "");
    if (!telefonoDigits) {
      errors.telefono = "Campo obligatorio";
    } else if (telefonoDigits.length !== 10) {
      errors.telefono = "Debe tener exactamente 10 dígitos";
    }
    
    if (!newProveedor.tipoProductoServicio.trim()) {
      errors.tipoProductoServicio = "Campo obligatorio";
    }
    
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleConfirmSave = () => {
    if (!validateNewProveedor()) {
      toast.error("Por favor completa todos los campos obligatorios para crear el proveedor");
      return;
    }
    setConfirmDialogOpen(true);
  };

  const handleCreateProveedor = async () => {
    setConfirmDialogOpen(false);
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
        banco: "",
        tipoCuenta: "",
        numeroCuenta: "",
      });
      setFormErrors({});
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

    if (colConfig.key === "datosBancarios" && !colConfig.isCustom) {
      return {
        key: colConfig.key,
        header: colConfig.header,
        width: colConfig.width,
        render: (p: Proveedor) => (
          <div className="flex items-center gap-2 text-xs">
            <div className="flex items-center gap-1">
              <BancoAutocomplete
                value={p.banco || ""}
                onChange={(value) => handleUpdateProveedor(p.id, "banco", value)}
                placeholder="Banco"
                className="w-28"
              />
            </div>
            <span className="text-muted-foreground">|</span>
            <Select
              value={p.tipoCuenta || ""}
              onValueChange={(value) => handleUpdateProveedor(p.id, "tipoCuenta", value)}
            >
              <SelectTrigger className="h-7 w-24 text-xs">
                <SelectValue placeholder="Cuenta" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Ahorros">Ahorros</SelectItem>
                <SelectItem value="Corriente">Corriente</SelectItem>
              </SelectContent>
            </Select>
            <span className="text-muted-foreground">|</span>
            <Input
              value={p.numeroCuenta || ""}
              onChange={(e) => handleUpdateProveedor(p.id, "numeroCuenta", e.target.value)}
              placeholder="# Cuenta"
              className="h-7 w-28 text-xs"
            />
          </div>
        ),
      };
    }

    if (colConfig.key === "certificadoBancario" && !colConfig.isCustom) {
      return {
        key: colConfig.key,
        header: colConfig.header,
        width: colConfig.width,
        render: (p: Proveedor) => (
          <CertificadoBancarioUpload
            proveedorId={p.id}
            proveedorNombre={p.nombre}
            certificadoUrl={p.certificadoBancario || null}
            onCertificadoChange={(url) => handleUpdateProveedor(p.id, "certificadoBancario", url || "")}
            disabled={!isAdmin && role?.toLowerCase() !== "operativo"}
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
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate("/historial-cotizaciones")}
              >
                <History className="h-4 w-4 mr-2" />
                Historial Cotizaciones
              </Button>
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
                <Label>Categoría *</Label>
                <Input
                  value={newProveedor.categoria}
                  onChange={(e) => {
                    setNewProveedor(prev => ({ ...prev, categoria: e.target.value }));
                    if (formErrors.categoria) setFormErrors(prev => ({ ...prev, categoria: "" }));
                  }}
                  placeholder="Ej: Transporte, Equipos, Catering..."
                  className={formErrors.categoria ? "border-destructive" : ""}
                />
                {formErrors.categoria && (
                  <p className="text-xs text-destructive">{formErrors.categoria}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label>Nombre *</Label>
                <Input
                  value={newProveedor.nombre}
                  onChange={(e) => {
                    setNewProveedor(prev => ({ ...prev, nombre: e.target.value }));
                    if (formErrors.nombre) setFormErrors(prev => ({ ...prev, nombre: "" }));
                  }}
                  placeholder="Nombre del proveedor"
                  className={formErrors.nombre ? "border-destructive" : ""}
                />
                {formErrors.nombre && (
                  <p className="text-xs text-destructive">{formErrors.nombre}</p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Teléfono * (10 dígitos)</Label>
                  <Input
                    value={newProveedor.telefono}
                    onChange={(e) => {
                      // Solo permitir números
                      const value = e.target.value.replace(/\D/g, "").slice(0, 10);
                      setNewProveedor(prev => ({ ...prev, telefono: value }));
                      if (formErrors.telefono) setFormErrors(prev => ({ ...prev, telefono: "" }));
                    }}
                    placeholder="3001234567"
                    maxLength={10}
                    className={formErrors.telefono ? "border-destructive" : ""}
                  />
                  <div className="flex justify-between">
                    {formErrors.telefono ? (
                      <p className="text-xs text-destructive">{formErrors.telefono}</p>
                    ) : (
                      <span></span>
                    )}
                    <p className="text-xs text-muted-foreground">
                      {newProveedor.telefono.length}/10
                    </p>
                  </div>
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
                <Label>Tipo de Producto o Servicio *</Label>
                <Input
                  value={newProveedor.tipoProductoServicio}
                  onChange={(e) => {
                    setNewProveedor(prev => ({ ...prev, tipoProductoServicio: e.target.value }));
                    if (formErrors.tipoProductoServicio) setFormErrors(prev => ({ ...prev, tipoProductoServicio: "" }));
                  }}
                  placeholder="Descripción del producto/servicio"
                  className={formErrors.tipoProductoServicio ? "border-destructive" : ""}
                />
                {formErrors.tipoProductoServicio && (
                  <p className="text-xs text-destructive">{formErrors.tipoProductoServicio}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label>Notas</Label>
                <Input
                  value={newProveedor.notas}
                  onChange={(e) => setNewProveedor(prev => ({ ...prev, notas: e.target.value }))}
                  placeholder="Notas adicionales"
                />
              </div>

              {/* DATOS BANCARIOS */}
              <div className="space-y-3 pt-2 border-t">
                <Label className="text-sm font-semibold">DATOS BANCARIOS</Label>
                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Banco</Label>
                    <BancoAutocomplete
                      value={newProveedor.banco}
                      onChange={(value) => setNewProveedor(prev => ({ ...prev, banco: value }))}
                      placeholder="Buscar banco..."
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Cuenta</Label>
                    <Select
                      value={newProveedor.tipoCuenta}
                      onValueChange={(value) => setNewProveedor(prev => ({ ...prev, tipoCuenta: value }))}
                    >
                      <SelectTrigger className="h-9">
                        <SelectValue placeholder="Tipo" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Ahorros">Ahorros</SelectItem>
                        <SelectItem value="Corriente">Corriente</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground"># de Cuenta</Label>
                    <Input
                      value={newProveedor.numeroCuenta}
                      onChange={(e) => setNewProveedor(prev => ({ ...prev, numeroCuenta: e.target.value }))}
                      placeholder="Número de cuenta"
                    />
                  </div>
                </div>
              </div>
            </div>

            <DialogFooter className="mt-6">
              <Button variant="outline" onClick={() => setNewProveedorOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={handleConfirmSave} disabled={saving}>
                {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Guardar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Confirmation Dialog */}
        <Dialog open={confirmDialogOpen} onOpenChange={setConfirmDialogOpen}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>Confirmar información</DialogTitle>
            </DialogHeader>
            <div className="py-4">
              <p className="text-sm text-muted-foreground">
                ¿Está seguro de que la información ingresada es correcta?
              </p>
              <div className="mt-4 p-3 bg-muted rounded-md text-sm space-y-1">
                <p><strong>Categoría:</strong> {newProveedor.categoria}</p>
                <p><strong>Nombre:</strong> {newProveedor.nombre}</p>
                <p><strong>Teléfono:</strong> {newProveedor.telefono}</p>
                <p><strong>Tipo:</strong> {newProveedor.tipoProductoServicio}</p>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setConfirmDialogOpen(false)}>
                Revisar
              </Button>
              <Button onClick={handleCreateProveedor} disabled={saving}>
                {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Confirmar
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

                {/* DATOS BANCARIOS */}
                {(selectedProveedor.banco || selectedProveedor.tipoCuenta || selectedProveedor.numeroCuenta) && (
                  <div className="pt-2 border-t">
                    <span className="text-xs text-muted-foreground font-semibold">Datos Bancarios</span>
                    <p className="text-sm mt-1">
                      {selectedProveedor.banco || "-"} | {selectedProveedor.tipoCuenta || "-"} | {selectedProveedor.numeroCuenta || "-"}
                    </p>
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
          onColumnsChange={setManagedColumns}
          panelName="Proveedores"
          readOnly={!canModifyStructure}
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
