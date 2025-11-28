import { useState } from "react";
import Layout from "@/components/Layout";
import { PanelHeader } from "@/components/PanelHeader";
import { CustomField, FieldType } from "@/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Plus, GripVertical, Trash2, Settings2, Database } from "lucide-react";

const fieldTypes: { value: FieldType; label: string }[] = [
  { value: "text", label: "Texto" },
  { value: "number", label: "Número" },
  { value: "list", label: "Lista" },
  { value: "file", label: "Archivo" },
  { value: "boolean", label: "Sí/No" },
  { value: "date", label: "Fecha" },
  { value: "dateRange", label: "Rango de fechas" },
  { value: "relation", label: "Relación" },
];

const panels = ["directivo", "general", "operaciones", "proveedores"];

const mockCustomFields: CustomField[] = [
  {
    id: "cf1",
    name: "Centro de Costos",
    key: "centroCostos",
    type: "text",
    isSSOT: true,
    panels: ["directivo", "general", "operaciones"],
    affectsGantt: false,
    syncEnabled: true,
    order: 1,
  },
  {
    id: "cf2",
    name: "#Factura",
    key: "numFactura",
    type: "text",
    isSSOT: true,
    panels: ["directivo", "general", "operaciones"],
    affectsGantt: false,
    syncEnabled: true,
    order: 2,
  },
  {
    id: "cf3",
    name: "Fecha de Montaje",
    key: "fechaMontaje",
    type: "dateRange",
    isSSOT: true,
    panels: ["directivo", "general", "operaciones"],
    affectsGantt: true,
    ganttColor: "#6b7280",
    syncEnabled: true,
    order: 3,
  },
  {
    id: "cf4",
    name: "Fecha de Ejecución",
    key: "fechaEjecucion",
    type: "dateRange",
    isSSOT: true,
    panels: ["directivo", "general", "operaciones"],
    affectsGantt: true,
    ganttColor: "#0ea5e9",
    syncEnabled: true,
    order: 4,
  },
];

const Constructor = () => {
  const [fields, setFields] = useState<CustomField[]>(mockCustomFields);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [newField, setNewField] = useState<Partial<CustomField>>({
    type: "text",
    isSSOT: false,
    panels: [],
    affectsGantt: false,
    syncEnabled: true,
  });

  const handleCreateField = () => {
    if (!newField.name || !newField.key) return;

    const field: CustomField = {
      id: `cf${Date.now()}`,
      name: newField.name,
      key: newField.key,
      type: newField.type as FieldType,
      isSSOT: newField.isSSOT || false,
      panels: newField.panels || [],
      affectsGantt: newField.affectsGantt || false,
      ganttColor: newField.ganttColor,
      syncEnabled: newField.syncEnabled || true,
      order: fields.length + 1,
    };

    setFields([...fields, field]);
    setIsDialogOpen(false);
    setNewField({
      type: "text",
      isSSOT: false,
      panels: [],
      affectsGantt: false,
      syncEnabled: true,
    });
  };

  const handleDeleteField = (id: string) => {
    setFields(fields.filter((f) => f.id !== id));
  };

  const togglePanel = (panel: string) => {
    const currentPanels = newField.panels || [];
    if (currentPanels.includes(panel)) {
      setNewField({ ...newField, panels: currentPanels.filter((p) => p !== panel) });
    } else {
      setNewField({ ...newField, panels: [...currentPanels, panel] });
    }
  };

  return (
    <Layout>
      <div className="space-y-6">
        <PanelHeader
          title="Constructor de Campos y Estructuras"
          description="Administra los campos personalizados y la estructura de la plataforma"
          actions={
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button size="sm">
                  <Plus className="h-4 w-4 mr-2" />
                  Nuevo Campo
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-lg">
                <DialogHeader>
                  <DialogTitle>Crear Nuevo Campo</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 mt-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Nombre del campo</Label>
                      <Input
                        value={newField.name || ""}
                        onChange={(e) => setNewField({ ...newField, name: e.target.value })}
                        placeholder="Ej: Estado del Cliente"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Clave (key)</Label>
                      <Input
                        value={newField.key || ""}
                        onChange={(e) => setNewField({ ...newField, key: e.target.value })}
                        placeholder="Ej: estadoCliente"
                        className="font-mono"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Tipo de campo</Label>
                    <Select
                      value={newField.type}
                      onValueChange={(v) => setNewField({ ...newField, type: v as FieldType })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {fieldTypes.map((ft) => (
                          <SelectItem key={ft.value} value={ft.value}>
                            {ft.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-3">
                    <Label>Paneles donde aparece</Label>
                    <div className="flex flex-wrap gap-3">
                      {panels.map((panel) => (
                        <div key={panel} className="flex items-center gap-2">
                          <Checkbox
                            checked={(newField.panels || []).includes(panel)}
                            onCheckedChange={() => togglePanel(panel)}
                          />
                          <span className="text-sm capitalize">{panel}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <Label>Es SSOT</Label>
                        <p className="text-xs text-muted-foreground">
                          Se sincroniza en todos los paneles
                        </p>
                      </div>
                      <Switch
                        checked={newField.isSSOT}
                        onCheckedChange={(v) => setNewField({ ...newField, isSSOT: v })}
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <div>
                        <Label>Afecta el Gantt</Label>
                        <p className="text-xs text-muted-foreground">
                          Mostrar en el diagrama Gantt
                        </p>
                      </div>
                      <Switch
                        checked={newField.affectsGantt}
                        onCheckedChange={(v) => setNewField({ ...newField, affectsGantt: v })}
                      />
                    </div>

                    {newField.affectsGantt && (
                      <div className="space-y-2">
                        <Label>Color en Gantt</Label>
                        <Input
                          type="color"
                          value={newField.ganttColor || "#0ea5e9"}
                          onChange={(e) => setNewField({ ...newField, ganttColor: e.target.value })}
                          className="w-20 h-9"
                        />
                      </div>
                    )}
                  </div>

                  <Button onClick={handleCreateField} className="w-full">
                    Crear Campo
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          }
        />

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Database className="h-4 w-4 text-primary" />
              Campos SSOT (Single Source of Truth)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {fields
                .filter((f) => f.isSSOT)
                .map((field) => (
                  <div
                    key={field.id}
                    className="flex items-center justify-between p-3 rounded-lg bg-muted/50 border border-border"
                  >
                    <div className="flex items-center gap-3">
                      <GripVertical className="h-4 w-4 text-muted-foreground cursor-grab" />
                      <div>
                        <span className="font-medium text-sm">{field.name}</span>
                        <span className="text-xs text-muted-foreground ml-2 font-mono">
                          {field.key}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="text-xs text-muted-foreground capitalize">
                        {field.type}
                      </span>
                      {field.affectsGantt && (
                        <div
                          className="w-4 h-4 rounded"
                          style={{ backgroundColor: field.ganttColor }}
                          title="Color en Gantt"
                        />
                      )}
                      <div className="flex gap-1">
                        {field.panels.map((p) => (
                          <span
                            key={p}
                            className="text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary capitalize"
                          >
                            {p.substring(0, 3)}
                          </span>
                        ))}
                      </div>
                      <Button variant="ghost" size="icon" className="h-7 w-7">
                        <Settings2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Otros Campos</CardTitle>
          </CardHeader>
          <CardContent>
            {fields.filter((f) => !f.isSSOT).length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                No hay campos personalizados adicionales
              </p>
            ) : (
              <div className="space-y-2">
                {fields
                  .filter((f) => !f.isSSOT)
                  .map((field) => (
                    <div
                      key={field.id}
                      className="flex items-center justify-between p-3 rounded-lg border border-border"
                    >
                      <div className="flex items-center gap-3">
                        <GripVertical className="h-4 w-4 text-muted-foreground cursor-grab" />
                        <div>
                          <span className="font-medium text-sm">{field.name}</span>
                          <span className="text-xs text-muted-foreground ml-2 font-mono">
                            {field.key}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button variant="ghost" size="icon" className="h-7 w-7">
                          <Settings2 className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-destructive hover:text-destructive"
                          onClick={() => handleDeleteField(field.id)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
};

export default Constructor;
