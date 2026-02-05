import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { EmpleadoAutocomplete } from "@/components/EmpleadoAutocomplete";
import { ProveedorAutocomplete } from "@/components/ProveedorAutocomplete";
import { Users, Package, ArrowRightLeft } from "lucide-react";

interface ResponsableData {
  tipo: 'empleado' | 'proveedor' | undefined;
  id: string | undefined;
  nombre: string | undefined;
}

interface InventarioResponsablesSelectorProps {
  responsableEntradasSalidas: ResponsableData;
  responsableMaterialEvento: ResponsableData;
  onResponsableEntradasSalidasChange: (data: ResponsableData) => void;
  onResponsableMaterialEventoChange: (data: ResponsableData) => void;
}

export function InventarioResponsablesSelector({
  responsableEntradasSalidas,
  responsableMaterialEvento,
  onResponsableEntradasSalidasChange,
  onResponsableMaterialEventoChange,
}: InventarioResponsablesSelectorProps) {
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
        <div className="space-y-2">
          <Label className="text-xs font-medium flex items-center gap-1.5">
            <ArrowRightLeft className="h-3.5 w-3.5" />
            Responsable de Entradas y Salidas
          </Label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <Select
              value={responsableEntradasSalidas.tipo || ""}
              onValueChange={(value) => {
                // Reset when type changes
                onResponsableEntradasSalidasChange({
                  tipo: value as 'empleado' | 'proveedor',
                  id: undefined,
                  nombre: undefined,
                });
              }}
            >
              <SelectTrigger className="h-9">
                <SelectValue placeholder="Tipo de responsable" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="empleado">Empleado</SelectItem>
                <SelectItem value="proveedor">Proveedor</SelectItem>
              </SelectContent>
            </Select>

            {responsableEntradasSalidas.tipo === 'empleado' && (
              <EmpleadoAutocomplete
                value={responsableEntradasSalidas.nombre || ""}
                onChange={(nombre, empleadoId) => {
                  onResponsableEntradasSalidasChange({
                    tipo: 'empleado',
                    id: empleadoId,
                    nombre: nombre,
                  });
                }}
                tipoPersonal="BBM"
                useEmpleadoId
                placeholder="Seleccionar empleado..."
              />
            )}

            {responsableEntradasSalidas.tipo === 'proveedor' && (
              <ProveedorAutocomplete
                value={responsableEntradasSalidas.nombre || ""}
                onChange={(nombre, proveedorId, proveedorData) => {
                  onResponsableEntradasSalidasChange({
                    tipo: 'proveedor',
                    id: proveedorId,
                    nombre: nombre,
                  });
                }}
                placeholder="Seleccionar proveedor..."
              />
            )}
          </div>
          {responsableEntradasSalidas.nombre && (
            <p className="text-xs text-muted-foreground pl-1">
              Seleccionado: <span className="font-medium text-foreground">{responsableEntradasSalidas.nombre}</span>
            </p>
          )}
        </div>

        {/* Responsable del Material durante el Evento */}
        <div className="space-y-2">
          <Label className="text-xs font-medium flex items-center gap-1.5">
            <Package className="h-3.5 w-3.5" />
            Responsable del Material durante el Evento
          </Label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <Select
              value={responsableMaterialEvento.tipo || ""}
              onValueChange={(value) => {
                // Reset when type changes
                onResponsableMaterialEventoChange({
                  tipo: value as 'empleado' | 'proveedor',
                  id: undefined,
                  nombre: undefined,
                });
              }}
            >
              <SelectTrigger className="h-9">
                <SelectValue placeholder="Tipo de responsable" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="empleado">Empleado</SelectItem>
                <SelectItem value="proveedor">Proveedor</SelectItem>
              </SelectContent>
            </Select>

            {responsableMaterialEvento.tipo === 'empleado' && (
              <EmpleadoAutocomplete
                value={responsableMaterialEvento.nombre || ""}
                onChange={(nombre, empleadoId) => {
                  onResponsableMaterialEventoChange({
                    tipo: 'empleado',
                    id: empleadoId,
                    nombre: nombre,
                  });
                }}
                tipoPersonal="BBM"
                useEmpleadoId
                placeholder="Seleccionar empleado..."
              />
            )}

            {responsableMaterialEvento.tipo === 'proveedor' && (
              <ProveedorAutocomplete
                value={responsableMaterialEvento.nombre || ""}
                onChange={(nombre, proveedorId, proveedorData) => {
                  onResponsableMaterialEventoChange({
                    tipo: 'proveedor',
                    id: proveedorId,
                    nombre: nombre,
                  });
                }}
                placeholder="Seleccionar proveedor..."
              />
            )}
          </div>
          {responsableMaterialEvento.nombre && (
            <p className="text-xs text-muted-foreground pl-1">
              Seleccionado: <span className="font-medium text-foreground">{responsableMaterialEvento.nombre}</span>
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export default InventarioResponsablesSelector;
