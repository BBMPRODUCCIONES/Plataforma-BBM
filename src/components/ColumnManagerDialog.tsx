import { useState } from "react";
import { Columns, Plus, Pencil, Trash2, GripVertical, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { CellType } from "./EditableCell";
import { cn } from "@/lib/utils";

export interface ColumnConfig {
  key: string;
  header: string;
  type: CellType;
  width: string;
  options?: string[];
  visible: boolean;
  isCustom: boolean;
  order: number;
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
  
  // Form state for create/edit
  const [columnName, setColumnName] = useState("");
  const [columnType, setColumnType] = useState<CellType>("text");
  const [columnWidth, setColumnWidth] = useState("120px");
  const [selectOptions, setSelectOptions] = useState("");
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);

  const resetForm = () => {
    setColumnName("");
    setColumnType("text");
    setColumnWidth("120px");
    setSelectOptions("");
    setEditingColumn(null);
    setIsCreating(false);
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
      order: columns.length,
      ...(columnType === "select" && selectOptions
        ? { options: selectOptions.split("\n").map((o) => o.trim()).filter(Boolean) }
        : {}),
    };

    onColumnsChange([...columns, newColumn]);
    resetForm();
    setActiveTab("list");
  };

  const handleEditColumn = () => {
    if (!editingColumn || !columnName.trim()) return;

    const updatedColumns = columns.map((col) =>
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

    onColumnsChange(updatedColumns);
    resetForm();
    setActiveTab("list");
  };

  const handleDeleteColumn = (key: string) => {
    const column = columns.find((c) => c.key === key);
    if (!column?.isCustom) return;
    
    onColumnsChange(columns.filter((col) => col.key !== key));
  };

  const handleToggleVisibility = (key: string) => {
    const updatedColumns = columns.map((col) =>
      col.key === key ? { ...col, visible: !col.visible } : col
    );
    onColumnsChange(updatedColumns);
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

    const newColumns = [...columns];
    const draggedColumn = newColumns[draggedIndex];
    newColumns.splice(draggedIndex, 1);
    newColumns.splice(index, 0, draggedColumn);

    // Update order
    newColumns.forEach((col, i) => {
      col.order = i;
    });

    onColumnsChange(newColumns);
    setDraggedIndex(index);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
  };

  const sortedColumns = [...columns].sort((a, b) => a.order - b.order);

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
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => handleToggleVisibility(column.key)}
                        title={column.visible ? "Ocultar columna" : "Mostrar columna"}
                      >
                        {column.visible ? (
                          <Eye className="h-4 w-4" />
                        ) : (
                          <EyeOff className="h-4 w-4 text-muted-foreground" />
                        )}
                      </Button>

                      {column.isCustom && (
                        <>
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
                            onClick={() => handleDeleteColumn(column.key)}
                            title="Eliminar columna"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>

            <p className="text-xs text-muted-foreground mt-4">
              Arrastra las columnas para reordenarlas. Las columnas base solo pueden ocultarse.
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
    </Dialog>
  );
}
