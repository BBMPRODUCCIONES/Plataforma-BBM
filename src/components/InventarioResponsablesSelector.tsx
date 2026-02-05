import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { EmpleadoAutocomplete } from "@/components/EmpleadoAutocomplete";
import { ProveedorAutocomplete } from "@/components/ProveedorAutocomplete";
import { Users, Package, ArrowRightLeft, Plus, Trash2 } from "lucide-react";

export interface ResponsableData {
  id: string;
  tipo: 'empleado' | 'proveedor' | undefined;
  responsableId: string | undefined;
  nombre: string | undefined;
}

interface InventarioResponsablesSelectorProps {
  responsablesEntradasSalidas: ResponsableData[];
  responsablesMaterialEvento: ResponsableData[];
  onResponsablesEntradasSalidasChange: (data: ResponsableData[]) => void;
  onResponsablesMaterialEventoChange: (data: ResponsableData[]) => void;
}

const createEmptyResponsable = (): ResponsableData => ({
  id: crypto.randomUUID(),
  tipo: undefined,
  responsableId: undefined,
  nombre: undefined,
});

function ResponsableRow({
  responsable,
  onUpdate,
  onRemove,
  canRemove,
}: {
  responsable: ResponsableData;
  onUpdate: (data: ResponsableData) => void;
  onRemove: () => void;
  canRemove: boolean;
}) {
  const handleTipoChange = (value: string) => {
    onUpdate({
      ...responsable,
      tipo: value as 'empleado' | 'proveedor',
      responsableId: undefined,
      nombre: undefined,
    });
  };

  const handleEmpleadoChange = (nombre: string, empleadoId?: string) => {
    onUpdate({
      ...responsable,
      responsableId: empleadoId,
      nombre: nombre,
    });
  };

  const handleProveedorChange = (nombre: string, proveedorId?: string) => {
    onUpdate({
      ...responsable,
      responsableId: proveedorId,
      nombre: nombre,
    });
  };

  return (
    <div className="flex items-start gap-2">
      <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-2">
        <Select
          value={responsable.tipo || ""}
          onValueChange={handleTipoChange}
        >
          <SelectTrigger className="h-9">
            <SelectValue placeholder="Tipo de responsable" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="empleado">Empleado</SelectItem>
            <SelectItem value="proveedor">Proveedor</SelectItem>
          </SelectContent>
        </Select>

        {responsable.tipo === 'empleado' && (
          <EmpleadoAutocomplete
            value={responsable.nombre || ""}
            onChange={handleEmpleadoChange}
            tipoPersonal="BBM"
            useEmpleadoId
            placeholder="Seleccionar empleado..."
          />
        )}

        {responsable.tipo === 'proveedor' && (
          <ProveedorAutocomplete
            value={responsable.nombre || ""}
            onChange={handleProveedorChange}
            placeholder="Seleccionar proveedor..."
          />
        )}

        {!responsable.tipo && (
          <div className="h-9 bg-muted/50 rounded-md flex items-center justify-center text-xs text-muted-foreground">
            Seleccione tipo primero
          </div>
        )}
      </div>
      
      {canRemove && (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-9 w-9 text-destructive hover:text-destructive shrink-0"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onRemove();
          }}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      )}
    </div>
  );
}

export function InventarioResponsablesSelector({
  responsablesEntradasSalidas,
  responsablesMaterialEvento,
  onResponsablesEntradasSalidasChange,
  onResponsablesMaterialEventoChange,
}: InventarioResponsablesSelectorProps) {
  // Ensure at least one empty entry exists
  const entradasSalidas = responsablesEntradasSalidas.length > 0 
    ? responsablesEntradasSalidas 
    : [createEmptyResponsable()];
  
  const materialEvento = responsablesMaterialEvento.length > 0 
    ? responsablesMaterialEvento 
    : [createEmptyResponsable()];

  const handleAddEntradasSalidas = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onResponsablesEntradasSalidasChange([...entradasSalidas, createEmptyResponsable()]);
  };

  const handleUpdateEntradasSalidas = (index: number, data: ResponsableData) => {
    const updated = [...entradasSalidas];
    updated[index] = data;
    onResponsablesEntradasSalidasChange(updated);
  };

  const handleRemoveEntradasSalidas = (index: number) => {
    const updated = entradasSalidas.filter((_, i) => i !== index);
    onResponsablesEntradasSalidasChange(updated.length > 0 ? updated : [createEmptyResponsable()]);
  };

  const handleAddMaterialEvento = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onResponsablesMaterialEventoChange([...materialEvento, createEmptyResponsable()]);
  };

  const handleUpdateMaterialEvento = (index: number, data: ResponsableData) => {
    const updated = [...materialEvento];
    updated[index] = data;
    onResponsablesMaterialEventoChange(updated);
  };

  const handleRemoveMaterialEvento = (index: number) => {
    const updated = materialEvento.filter((_, i) => i !== index);
    onResponsablesMaterialEventoChange(updated.length > 0 ? updated : [createEmptyResponsable()]);
  };

  // Count valid selections
  const validEntradasSalidas = entradasSalidas.filter(r => r.nombre).length;
  const validMaterialEvento = materialEvento.filter(r => r.nombre).length;

  return (
    <Card className="mt-4 border-dashed">
      <CardHeader className="py-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <Users className="h-4 w-4" />
          Responsables del Inventario
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Responsable de Entradas y Salidas */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label className="text-xs font-medium flex items-center gap-1.5">
              <ArrowRightLeft className="h-3.5 w-3.5" />
              Responsable de Entradas y Salidas
              {validEntradasSalidas > 0 && (
                <span className="text-muted-foreground">({validEntradasSalidas})</span>
              )}
            </Label>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-7 text-xs px-2"
              onClick={handleAddEntradasSalidas}
            >
              <Plus className="h-3 w-3 mr-1" />
              Agregar
            </Button>
          </div>
          
          <div className="space-y-2">
            {entradasSalidas.map((responsable, index) => (
              <ResponsableRow
                key={responsable.id}
                responsable={responsable}
                onUpdate={(data) => handleUpdateEntradasSalidas(index, data)}
                onRemove={() => handleRemoveEntradasSalidas(index)}
                canRemove={entradasSalidas.length > 1}
              />
            ))}
          </div>
        </div>

        <div className="border-t border-dashed my-4" />

        {/* Responsable del Material durante el Evento */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label className="text-xs font-medium flex items-center gap-1.5">
              <Package className="h-3.5 w-3.5" />
              Responsable del Material durante el Evento
              {validMaterialEvento > 0 && (
                <span className="text-muted-foreground">({validMaterialEvento})</span>
              )}
            </Label>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-7 text-xs px-2"
              onClick={handleAddMaterialEvento}
            >
              <Plus className="h-3 w-3 mr-1" />
              Agregar
            </Button>
          </div>
          
          <div className="space-y-2">
            {materialEvento.map((responsable, index) => (
              <ResponsableRow
                key={responsable.id}
                responsable={responsable}
                onUpdate={(data) => handleUpdateMaterialEvento(index, data)}
                onRemove={() => handleRemoveMaterialEvento(index)}
                canRemove={materialEvento.length > 1}
              />
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default InventarioResponsablesSelector;
