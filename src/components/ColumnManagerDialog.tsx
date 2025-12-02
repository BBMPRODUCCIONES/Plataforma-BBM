import { useState, useEffect } from "react";
import { Columns, Plus, Pencil, Trash2, GripVertical, Eye, EyeOff, Settings2 } from "lucide-react";
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
  onColumnsChange: (columns: ColumnConfig[]) => void;
  panelName: string;
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
}: ColumnManagerDialogProps) {
  const [activeTab, setActiveTab] = useState("list");
  const [editingColumn, setEditingColumn] = useState<ColumnConfig | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  
  // Local state that syncs with props
  const [localColumns, setLocalColumns] = useState<ColumnConfig[]>(columns);
  
  // Sync local state with props when props change or dialog opens
  useEffect(() => {
    if (open) {
      setLocalColumns([...columns]);
    }
  }, [columns, open]);
  
  // Form state for create/edit
  const [columnName, setColumnName] = useState("");
  const [columnType, setColumnType] = useState<CellType>("text");
  const [columnWidth, setColumnWidth] = useState("120px");
  const [selectOptions, setSelectOptions] = useState("");
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [columnToDelete, setColumnToDelete] = useState<ColumnConfig | null>(null);

  const resetForm = () => {
    setColumnName("");
    setColumnType("text");
    setColumnWidth("120px");
    setSelectOptions("");
    setEditingColumn(null);
    setIsCreating(false);
  };

  // Helper to update both local and parent state
  const updateColumns = (newColumns: ColumnConfig[]) => {
    setLocalColumns([...newColumns]);
    onColumnsChange([...newColumns]);
  };

  const handleCreateColumn = () => {
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

    updateColumns([...localColumns, newColumn]);
    resetForm();
    setActiveTab("list");
  };

  const handleEditColumn = () => {
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

    updateColumns(updatedColumns);
    resetForm();
    setActiveTab("list");
  };

  const handleDeleteColumn = (column: ColumnConfig) => {
    setColumnToDelete(column);
    setDeleteConfirmOpen(true);
  };

  const confirmDeleteColumn = () => {
    if (columnToDelete) {
      const filteredColumns = localColumns.filter((col) => col.key !== columnToDelete.key);
      updateColumns(filteredColumns);
      setColumnToDelete(null);
      setDeleteConfirmOpen(false);
      // If we were editing this column, go back to list
      if (editingColumn?.key === columnToDelete.key) {
        resetForm();
        setActiveTab("list");
      }
    }
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

  const sortedColumns = [...localColumns].sort((a, b) => a.order - b.order);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Columns className="h-5 w-5" />
            Gestionar Columnas - {panelName}
          </DialogTitle>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="list">Columnas</TabsTrigger>
            <TabsTrigger value="edit">
              {isCreating ? "Nueva Columna" : editingColumn ? "Editar Columna" : "Nueva Columna"}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="list" className="mt-4">
            <div className="flex justify-end mb-4">
              <Button size="sm" onClick={startCreating}>
                <Plus className="h-4 w-4 mr-2" />
                Nueva Columna
              </Button>
            </div>

            <ScrollArea className="h-[400px] pr-4">
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
                        title="Eliminar columna"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>

            <p className="text-xs text-muted-foreground mt-4">
              Arrastra las columnas para reordenarlas. Usa el ícono de configuración para definir visibilidad por rol. Las columnas personalizadas pueden eliminarse.
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
                  Eliminar
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
            <AlertDialogTitle>¿Eliminar columna?</AlertDialogTitle>
            <AlertDialogDescription>
              {columnToDelete?.isCustom ? (
                <>¿Estás seguro de que deseas eliminar la columna "<strong>{columnToDelete?.header}</strong>"? Esta acción no se puede deshacer.</>
              ) : (
                <>La columna "<strong>{columnToDelete?.header}</strong>" es una columna base del sistema. ¿Estás seguro de que deseas eliminarla? Esto puede afectar la funcionalidad del panel.</>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDeleteColumn} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Dialog>
  );
}
