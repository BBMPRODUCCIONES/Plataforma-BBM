import { useState, useEffect, useMemo } from "react";
import { Columns, Plus, Pencil, Trash2, GripVertical, Eye, EyeOff, Settings2, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { CellType } from "./EditableCell";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export interface RoleVisibility {
  operativo: boolean;
  visual: boolean;
}

export interface ColumnConfig {
  key: string;
  header: string;
  type: CellType;
  width: string;
  options?: string[];
  visible: boolean;
  isCustom: boolean;
  order: number;
  roleVisibility?: RoleVisibility;
}

interface ColumnManagerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  columns: ColumnConfig[];
  onColumnsChange: (columns: ColumnConfig[]) => boolean | Promise<boolean> | void | Promise<void>;
  panelName: string;
  readOnly?: boolean;
}

const columnTypes: { value: CellType; label: string }[] = [
  { value: "text", label: "Texto" },
  { value: "number", label: "Número" },
  { value: "date", label: "Fecha" },
  { value: "select", label: "Lista desplegable" },
  { value: "file", label: "Archivo adjunto" },
  { value: "boolean", label: "Sí/No (Checkbox)" },
];

const widthOptions = [
  { value: "80px", label: "Pequeño (80px)" },
  { value: "120px", label: "Normal (120px)" },
  { value: "160px", label: "Mediano (160px)" },
  { value: "200px", label: "Grande (200px)" },
  { value: "250px", label: "Extra grande (250px)" },
];

export function ColumnManagerDialog({
  open,
  onOpenChange,
  columns,
  onColumnsChange,
  panelName,
  readOnly = false,
}: ColumnManagerDialogProps) {
  const [activeTab, setActiveTab] = useState("list");
  const [editingColumn, setEditingColumn] = useState<ColumnConfig | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  
  // Local state that syncs with props
  const [localColumns, setLocalColumns] = useState<ColumnConfig[]>(columns);
  const [initialSync, setInitialSync] = useState(false);
  
  // Only sync local state with props when dialog FIRST opens, not on subsequent prop changes
  useEffect(() => {
    if (open && !initialSync) {
      console.log('[ColumnManager] Dialog opened, syncing columns:', columns.length);
      setLocalColumns([...columns]);
      setInitialSync(true);
    }
    if (!open) {
      setInitialSync(false);
    }
  }, [open, initialSync]);
  
  // Form state for create/edit
  const [columnName, setColumnName] = useState("");
  const [columnType, setColumnType] = useState<CellType>("text");
  const [columnWidth, setColumnWidth] = useState("120px");
  const [selectOptions, setSelectOptions] = useState("");
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [columnToDelete, setColumnToDelete] = useState<ColumnConfig | null>(null);
  const [showHiddenColumns, setShowHiddenColumns] = useState(false);

  const resetForm = () => {
    setColumnName("");
    setColumnType("text");
    setColumnWidth("120px");
    setSelectOptions("");
    setEditingColumn(null);
    setIsCreating(false);
  };

  // Helper to update both local and parent state - ensure new references
  const updateColumns = async (newColumns: ColumnConfig[], closeAfter = false): Promise<boolean> => {
    const updatedColumns = newColumns.map(col => ({ ...col })); // Deep copy each column
    const previousColumns = [...localColumns]; // Store for rollback
    
    console.log('[ColumnManager] Updating columns:', updatedColumns.length);
    setLocalColumns(updatedColumns);
    
    // Call parent callback and wait for it
    if (typeof onColumnsChange === 'function') {
      console.log('[ColumnManager] Calling onColumnsChange...');
      try {
        const result = await onColumnsChange(updatedColumns);
        
        // Check if the save was successful (false means failure)
        if (result === false) {
          console.error('[ColumnManager] onColumnsChange returned false - reverting');
          setLocalColumns(previousColumns);
          return false;
        }
        
        console.log('[ColumnManager] onColumnsChange completed successfully');
        if (closeAfter) {
          onOpenChange(false);
        }
        return true;
      } catch (error) {
        console.error('[ColumnManager] Error in onColumnsChange:', error);
        setLocalColumns(previousColumns);
        return false;
      }
    } else {
      console.error('[ColumnManager] onColumnsChange is not a function!');
      setLocalColumns(previousColumns);
      return false;
    }
  };

  const handleCreateColumn = async () => {
    if (!columnName.trim()) return;

    const key = columnName
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "");

    const newColumn: ColumnConfig = {
      key: `custom_${key}_${Date.now()}`,
      header: columnName,
      type: columnType,
      width: columnWidth,
      visible: true,
      isCustom: true,
      order: localColumns.length,
      ...(columnType === "select" && selectOptions
        ? { options: selectOptions.split("\n").map((o) => o.trim()).filter(Boolean) }
        : {}),
    };

    await updateColumns([...localColumns, newColumn], true);
    resetForm();
  };

  const handleEditColumn = async () => {
    if (!editingColumn || !columnName.trim()) return;

    const updatedColumns = localColumns.map((col) =>
      col.key === editingColumn.key
        ? {
            ...col,
            header: columnName,
            type: columnType,
            width: columnWidth,
            ...(columnType === "select" && selectOptions
              ? { options: selectOptions.split("\n").map((o) => o.trim()).filter(Boolean) }
              : {}),
          }
        : col
    );

    await updateColumns(updatedColumns, true);
    resetForm();
  };

  const handleDeleteColumn = (column: ColumnConfig) => {
    setColumnToDelete(column);
    setDeleteConfirmOpen(true);
  };

  const confirmDeleteColumn = async () => {
    if (!columnToDelete) return;

    // Custom columns can be removed from the configuration.
    // Base/system columns are "removed from the panel" by hiding them (visible=false),
    // so they don't get auto-restored by the default-column merge.
    const nextColumns = columnToDelete.isCustom
      ? localColumns.filter((col) => col.key !== columnToDelete.key)
      : localColumns.map((col) =>
          col.key === columnToDelete.key ? { ...col, visible: false } : col
        );

    const ok = await updateColumns(nextColumns, true);
    if (ok && !columnToDelete.isCustom) {
      toast.success(`Columna "${columnToDelete.header}" quitada de este panel`);
    }

    setColumnToDelete(null);
    setDeleteConfirmOpen(false);
  };

  const handleToggleVisibility = (key: string) => {
    const updatedColumns = localColumns.map((col) =>
      col.key === key ? { ...col, visible: !col.visible } : col
    );
    updateColumns(updatedColumns);
  };

  const handleRoleVisibilityChange = (key: string, role: keyof RoleVisibility, value: boolean) => {
    const updatedColumns = localColumns.map((col) =>
      col.key === key
        ? {
            ...col,
            roleVisibility: {
              operativo: col.roleVisibility?.operativo ?? true,
              visual: col.roleVisibility?.visual ?? true,
              [role]: value,
            },
          }
        : col
    );
    updateColumns(updatedColumns);
  };

  const startEditing = (column: ColumnConfig) => {
    setEditingColumn(column);
    setColumnName(column.header);
    setColumnType(column.type);
    setColumnWidth(column.width);
    setSelectOptions(column.options?.join("\n") || "");
    setIsCreating(false);
    setActiveTab("edit");
  };

  const startCreating = () => {
    resetForm();
    setIsCreating(true);
    setActiveTab("edit");
  };

  const handleDragStart = (index: number) => {
    setDraggedIndex(index);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === index) return;

    const newColumns = [...localColumns];
    const draggedColumn = newColumns[draggedIndex];
    newColumns.splice(draggedIndex, 1);
    newColumns.splice(index, 0, draggedColumn);

    // Update order
    newColumns.forEach((col, i) => {
      col.order = i;
    });

    updateColumns(newColumns);
    setDraggedIndex(index);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
  };

  // Filter out hidden system columns from the main list (custom columns always show)
  const sortedColumns = useMemo(() => 
    [...localColumns]
      .filter(col => col.visible || col.isCustom)
      .sort((a, b) => a.order - b.order),
    [localColumns]
  );

  // Hidden system columns that can be restored
  const hiddenSystemColumns = useMemo(() => 
    localColumns.filter(col => !col.visible && !col.isCustom),
    [localColumns]
  );

  const handleRestoreColumn = async (key: string) => {
    const updatedColumns = localColumns.map(col =>
      col.key === key ? { ...col, visible: true } : col
    );
    const ok = await updateColumns(updatedColumns);
    if (ok) {
      toast.success("Columna restaurada");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Columns className="h-5 w-5" />
            Gestionar Columnas - {panelName}
          </DialogTitle>
          {!readOnly && (
            <p className="text-xs text-muted-foreground mt-1">
              🌐 Los cambios se aplicarán a todos los usuarios
            </p>
          )}
          {readOnly && (
            <p className="text-xs text-amber-500 mt-1">
              🔒 Solo lectura - Solo los administradores pueden modificar la estructura
            </p>
          )}
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className={cn("grid w-full", readOnly ? "grid-cols-1" : "grid-cols-2")}>
            <TabsTrigger value="list">Columnas</TabsTrigger>
            {!readOnly && (
              <TabsTrigger value="edit">
                {isCreating ? "Nueva Columna" : editingColumn ? "Editar Columna" : "Nueva Columna"}
              </TabsTrigger>
            )}
          </TabsList>

          <TabsContent value="list" className="mt-4">
            {!readOnly && (
              <div className="flex justify-end mb-4">
                <Button size="sm" onClick={startCreating}>
                  <Plus className="h-4 w-4 mr-2" />
                  Nueva Columna
                </Button>
              </div>
            )}

            <div className="max-h-[50vh] overflow-y-auto pr-2">
              <div className="space-y-2">
                {sortedColumns.map((column, index) => (
                  <div
                    key={column.key}
                    draggable
                    onDragStart={() => handleDragStart(index)}
                    onDragOver={(e) => handleDragOver(e, index)}
                    onDragEnd={handleDragEnd}
                    className={cn(
                      "flex items-center gap-3 p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors",
                      draggedIndex === index && "opacity-50 border-primary",
                      !column.visible && "opacity-60"
                    )}
                  >
                    <GripVertical className="h-4 w-4 text-muted-foreground cursor-grab" />
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium truncate">{column.header}</span>
                        {column.isCustom && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary/20 text-primary">
                            Personalizada
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground mt-0.5">
                        {columnTypes.find((t) => t.value === column.type)?.label} • {column.width}
                      </div>
                    </div>

                    <div className="flex items-center gap-1">
                      {!readOnly && (
                        <>
                          <Popover>
                            <PopoverTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                title="Configurar visibilidad por rol"
                              >
                                <Settings2 className="h-4 w-4" />
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-64 p-4" align="end">
                              <div className="space-y-4">
                                <div className="font-medium text-sm">Visibilidad por Rol</div>
                                
                                <div className="space-y-3">
                                  <div className="flex items-center justify-between text-sm">
                                    <span className="text-muted-foreground">Administrador</span>
                                    <Checkbox checked disabled className="opacity-50" />
                                  </div>
                                  
                                  <div className="flex items-center justify-between text-sm">
                                    <span>Operativo</span>
                                    <Checkbox
                                      checked={column.roleVisibility?.operativo ?? true}
                                      onCheckedChange={(checked) =>
                                        handleRoleVisibilityChange(column.key, "operativo", !!checked)
                                      }
                                    />
                                  </div>
                                  
                                  <div className="flex items-center justify-between text-sm">
                                    <span>Visual</span>
                                    <Checkbox
                                      checked={column.roleVisibility?.visual ?? true}
                                      onCheckedChange={(checked) =>
                                        handleRoleVisibilityChange(column.key, "visual", !!checked)
                                      }
                                    />
                                  </div>
                                </div>
                                
                                <p className="text-[11px] text-muted-foreground">
                                  El Administrador siempre puede ver todas las columnas.
                                </p>
                              </div>
                            </PopoverContent>
                          </Popover>

                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => startEditing(column)}
                            title="Editar columna"
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive hover:text-destructive"
                            onClick={() => handleDeleteColumn(column)}
                            title={column.isCustom ? "Eliminar columna" : "Quitar del panel (ocultar)"}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                          
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => handleToggleVisibility(column.key)}
                            title={column.visible ? "Ocultar columna" : "Mostrar columna"}
                          >
                            {column.visible ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                          </Button>
                        </>
                      )}
                      {readOnly && (
                        <span className="text-xs text-muted-foreground px-2">
                          {column.visible ? "Visible" : "Oculta"}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Hidden columns section */}
            {!readOnly && hiddenSystemColumns.length > 0 && (
              <div className="mt-4 border-t pt-4">
                <button
                  onClick={() => setShowHiddenColumns(!showHiddenColumns)}
                  className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  <RotateCcw className="h-4 w-4" />
                  {showHiddenColumns ? "Ocultar" : "Mostrar"} columnas quitadas ({hiddenSystemColumns.length})
                </button>
                
                {showHiddenColumns && (
                  <div className="mt-3 space-y-2">
                    {hiddenSystemColumns.map((column) => (
                      <div
                        key={column.key}
                        className="flex items-center justify-between p-2 rounded-lg border border-dashed bg-muted/30"
                      >
                        <div>
                          <span className="text-sm font-medium">{column.header}</span>
                          <span className="text-xs text-muted-foreground ml-2">
                            {columnTypes.find((t) => t.value === column.type)?.label}
                          </span>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleRestoreColumn(column.key)}
                        >
                          <RotateCcw className="h-3 w-3 mr-1" />
                          Restaurar
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            <p className="text-xs text-muted-foreground mt-4">
              Arrastra las columnas para reordenarlas. Usa el ícono de configuración para definir visibilidad por rol. Las columnas del sistema se pueden ocultar; las columnas personalizadas sí se pueden eliminar.
            </p>
          </TabsContent>

          <TabsContent value="edit" className="mt-4 space-y-4">
            <div className="space-y-2">
              <Label>Nombre de la columna</Label>
              <Input
                value={columnName}
                onChange={(e) => setColumnName(e.target.value)}
                placeholder="Ej: Estado del Pago"
              />
            </div>

            <div className="space-y-2">
              <Label>Tipo de dato</Label>
              <Select value={columnType} onValueChange={(v) => setColumnType(v as CellType)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-popover">
                  {columnTypes.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {columnType === "select" && (
              <div className="space-y-2">
                <Label>Opciones (una por línea)</Label>
                <Textarea
                  value={selectOptions}
                  onChange={(e) => setSelectOptions(e.target.value)}
                  placeholder={"Opción 1\nOpción 2\nOpción 3"}
                  rows={4}
                />
              </div>
            )}

            <div className="space-y-2">
              <Label>Ancho de columna</Label>
              <Select value={columnWidth} onValueChange={setColumnWidth}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-popover">
                  {widthOptions.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <DialogFooter className="mt-6">
              {editingColumn && (
                <Button
                  variant="destructive"
                  onClick={() => handleDeleteColumn(editingColumn)}
                  className="mr-auto"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  {editingColumn.isCustom ? "Eliminar" : "Quitar del panel"}
                </Button>
              )}
              <Button
                variant="outline"
                onClick={() => {
                  resetForm();
                  setActiveTab("list");
                }}
              >
                Cancelar
              </Button>
              <Button
                onClick={isCreating ? handleCreateColumn : handleEditColumn}
                disabled={!columnName.trim()}
              >
                {isCreating ? "Crear Columna" : "Guardar Cambios"}
              </Button>
            </DialogFooter>
          </TabsContent>
        </Tabs>
      </DialogContent>

      <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {columnToDelete?.isCustom ? "¿Eliminar columna?" : "¿Quitar columna del panel?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {columnToDelete?.isCustom ? (
                <>
                  ¿Estás seguro de que deseas eliminar la columna "<strong>{columnToDelete?.header}</strong>"? Esta acción no se puede deshacer.
                </>
              ) : (
                <>
                  Se ocultará la columna "<strong>{columnToDelete?.header}</strong>" solo en este panel. Puedes volver a mostrarla con el ícono de ojo.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDeleteColumn}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {columnToDelete?.isCustom ? "Eliminar" : "Quitar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Dialog>
  );
}
