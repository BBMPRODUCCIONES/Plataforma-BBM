import { useState } from "react";
import { Plus } from "lucide-react";
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
import { CellType } from "./EditableCell";

interface ColumnConfig {
  key: string;
  header: string;
  type: CellType;
  width: string;
  options?: string[];
}

interface AddColumnDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAddColumn: (column: ColumnConfig) => void;
}

const columnTypes: { value: CellType; label: string }[] = [
  { value: "text", label: "Texto" },
  { value: "number", label: "Número" },
  { value: "date", label: "Fecha" },
  { value: "select", label: "Lista desplegable" },
  { value: "file", label: "Archivo adjunto" },
  { value: "boolean", label: "Sí/No (Checkbox)" },
];

export function AddColumnDialog({ open, onOpenChange, onAddColumn }: AddColumnDialogProps) {
  const [columnName, setColumnName] = useState("");
  const [columnType, setColumnType] = useState<CellType>("text");
  const [columnWidth, setColumnWidth] = useState("120px");
  const [selectOptions, setSelectOptions] = useState("");

  const handleSubmit = () => {
    if (!columnName.trim()) return;

    const key = columnName
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "");

    const column: ColumnConfig = {
      key,
      header: columnName,
      type: columnType,
      width: columnWidth,
    };

    if (columnType === "select" && selectOptions) {
      column.options = selectOptions.split("\n").map((o) => o.trim()).filter(Boolean);
    }

    onAddColumn(column);
    resetForm();
    onOpenChange(false);
  };

  const resetForm = () => {
    setColumnName("");
    setColumnType("text");
    setColumnWidth("120px");
    setSelectOptions("");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Plus className="h-5 w-5" />
            Agregar Nueva Columna
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
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
                <SelectItem value="80px">Pequeño (80px)</SelectItem>
                <SelectItem value="120px">Normal (120px)</SelectItem>
                <SelectItem value="160px">Mediano (160px)</SelectItem>
                <SelectItem value="200px">Grande (200px)</SelectItem>
                <SelectItem value="250px">Extra grande (250px)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={!columnName.trim()}>
            Agregar Columna
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
