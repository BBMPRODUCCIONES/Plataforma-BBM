import { useState } from "react";
import { Button } from "@/components/ui/button";
import { logger } from "@/lib/logger";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { CalendarIcon, Plus } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Project, ProjectStatus } from "@/types";
import { useClientes } from "@/contexts/ClientesContext";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

interface NewProjectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onProjectCreate: (project: Partial<Project>) => void;
}

interface ValidationErrors {
  cliente?: string;
  evento?: string;
  montajeStart?: string;
  ejecucionStart?: string;
  ubicacion?: string;
}

export function NewProjectDialog({
  open,
  onOpenChange,
  onProjectCreate,
}: NewProjectDialogProps) {
  const { clientes } = useClientes();
  const [formData, setFormData] = useState<Partial<Project>>({
    estado: "por_planear",
  });
  const [montajeStart, setMontajeStart] = useState<Date>();
  const [montajeEnd, setMontajeEnd] = useState<Date>();
  const [ejecucionStart, setEjecucionStart] = useState<Date>();
  const [ejecucionEnd, setEjecucionEnd] = useState<Date>();
  const [errors, setErrors] = useState<ValidationErrors>({});

  const validateForm = (): boolean => {
    const newErrors: ValidationErrors = {};
    
    // Debug logging
    logger.debug("[NewProjectDialog] Validating form:", {
      cliente: formData.cliente,
      evento: formData.evento,
      montajeStart,
      ejecucionStart,
      ubicacion: formData.ubicacion,
      clientesDisponibles: clientes.length
    });
    
    if (!formData.cliente) {
      newErrors.cliente = "Este campo es obligatorio";
    }
    if (!formData.evento?.trim()) {
      newErrors.evento = "Este campo es obligatorio";
    }
    if (!montajeStart) {
      newErrors.montajeStart = "Este campo es obligatorio";
    }
    if (!ejecucionStart) {
      newErrors.ejecucionStart = "Este campo es obligatorio";
    }
    if (!formData.ubicacion?.trim()) {
      newErrors.ubicacion = "Este campo es obligatorio";
    }

    logger.debug("[NewProjectDialog] Validation errors:", newErrors);
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = () => {
    if (!validateForm()) {
      // Build list of missing fields for better feedback
      const missingFields = [];
      if (!formData.cliente) missingFields.push("Cliente");
      if (!formData.evento?.trim()) missingFields.push("Evento");
      if (!montajeStart) missingFields.push("Fecha Montaje Inicio");
      if (!ejecucionStart) missingFields.push("Fecha Ejecución Inicio");
      if (!formData.ubicacion?.trim()) missingFields.push("Ubicación");
      
      toast({
        title: "Campos requeridos",
        description: `Faltan: ${missingFields.join(", ")}`,
        variant: "destructive",
      });
      return;
    }

    const newProject: Partial<Project> = {
      ...formData,
      id: `proj-${Date.now()}`,
      fechaMontajeInicio: montajeStart ? format(montajeStart, "yyyy-MM-dd") : "",
      fechaMontajeFin: montajeEnd ? format(montajeEnd, "yyyy-MM-dd") : "",
      fechaEjecucionInicio: ejecucionStart ? format(ejecucionStart, "yyyy-MM-dd") : "",
      fechaEjecucionFin: ejecucionEnd ? format(ejecucionEnd, "yyyy-MM-dd") : "",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    onProjectCreate(newProject);
    
    // Reset form
    setFormData({ estado: "por_planear" });
    setMontajeStart(undefined);
    setMontajeEnd(undefined);
    setEjecucionStart(undefined);
    setEjecucionEnd(undefined);
    setErrors({});
    
    onOpenChange(false);

    toast({
      title: "Proyecto creado",
      description: "El proyecto se ha creado exitosamente",
    });
  };

  const handleOpenChange = (isOpen: boolean) => {
    if (!isOpen) {
      setErrors({});
    }
    onOpenChange(isOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Plus className="h-5 w-5" />
            Nuevo Proyecto
          </DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-4 py-4">
          {/* Centro de Costos */}
          <div className="space-y-2">
            <Label htmlFor="centroCostos">Centro de Costos</Label>
            <Input
              id="centroCostos"
              placeholder="Ej: 1-0006"
              value={formData.centroCostos || ""}
              onChange={(e) => setFormData({ ...formData, centroCostos: e.target.value })}
            />
          </div>

          {/* # Factura */}
          <div className="space-y-2">
            <Label htmlFor="numFactura"># Factura</Label>
            <Input
              id="numFactura"
              placeholder="Ej: C-7014"
              value={formData.numFactura || ""}
              onChange={(e) => setFormData({ ...formData, numFactura: e.target.value })}
            />
          </div>

          {/* Cliente */}
          <div className="space-y-2">
            <Label htmlFor="cliente">Cliente *</Label>
            <Select
              value={formData.cliente || ""}
              onValueChange={(value) => {
                setFormData({ ...formData, cliente: value });
                if (errors.cliente) setErrors({ ...errors, cliente: undefined });
              }}
            >
              <SelectTrigger className={cn(errors.cliente && "border-destructive")}>
                <SelectValue placeholder="Seleccionar cliente" />
              </SelectTrigger>
              <SelectContent>
                {clientes.length === 0 ? (
                  <div className="px-2 py-4 text-sm text-muted-foreground text-center">
                    No hay clientes. Créalos primero en Gestión de Clientes.
                  </div>
                ) : (
                  clientes.map((cliente) => (
                    <SelectItem key={cliente.id} value={cliente.nombre}>
                      {cliente.nombre}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
            {errors.cliente && <p className="text-sm text-destructive">{errors.cliente}</p>}
          </div>

          {/* Evento */}
          <div className="space-y-2">
            <Label htmlFor="evento">Evento *</Label>
            <Input
              id="evento"
              placeholder="Nombre del evento"
              value={formData.evento || ""}
              onChange={(e) => {
                setFormData({ ...formData, evento: e.target.value });
                if (errors.evento) setErrors({ ...errors, evento: undefined });
              }}
              className={cn(errors.evento && "border-destructive")}
            />
            {errors.evento && <p className="text-sm text-destructive">{errors.evento}</p>}
          </div>

          {/* Avanzada */}
          <div className="space-y-2">
            <Label htmlFor="avanzada">Avanzada</Label>
            <Select
              value={formData.avanzada || ""}
              onValueChange={(value) => setFormData({ ...formData, avanzada: value as Project["avanzada"] })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Seleccionar" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="SE_HIZO">Se hizo</SelectItem>
                <SelectItem value="NO_SE_HIZO">No se hizo</SelectItem>
                <SelectItem value="NO_NECESARIA">No necesaria</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Estado */}
          <div className="space-y-2">
            <Label htmlFor="estado">Estado</Label>
            <Select
              value={formData.estado || "por_planear"}
              onValueChange={(value) => setFormData({ ...formData, estado: value as ProjectStatus })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Estado" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="por_planear">Por Planear</SelectItem>
                <SelectItem value="por_ejecutar">Por Ejecutar</SelectItem>
                <SelectItem value="en_progreso">En Progreso</SelectItem>
                <SelectItem value="terminado">Terminado</SelectItem>
                <SelectItem value="facturado">Facturado</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Fecha Montaje Inicio */}
          <div className="space-y-2">
            <Label>Fecha Montaje Inicio *</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button 
                  variant="outline" 
                  className={cn(
                    "w-full justify-start text-left font-normal", 
                    !montajeStart && "text-muted-foreground",
                    errors.montajeStart && "border-destructive"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {montajeStart ? format(montajeStart, "PPP", { locale: es }) : "Seleccionar"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar 
                  mode="single" 
                  selected={montajeStart} 
                  onSelect={(date) => {
                    setMontajeStart(date);
                    if (errors.montajeStart) setErrors({ ...errors, montajeStart: undefined });
                  }} 
                  locale={es} 
                  className="pointer-events-auto" 
                />
              </PopoverContent>
            </Popover>
            {errors.montajeStart && <p className="text-sm text-destructive">{errors.montajeStart}</p>}
          </div>

          {/* Fecha Montaje Fin */}
          <div className="space-y-2">
            <Label>Fecha Montaje Fin</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !montajeEnd && "text-muted-foreground")}>
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {montajeEnd ? format(montajeEnd, "PPP", { locale: es }) : "Seleccionar"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar mode="single" selected={montajeEnd} onSelect={setMontajeEnd} locale={es} className="pointer-events-auto" />
              </PopoverContent>
            </Popover>
          </div>

          {/* Hora Montaje */}
          <div className="space-y-2">
            <Label htmlFor="horaMontajeInicio">Hora Montaje (Inicio - Fin)</Label>
            <div className="flex gap-2">
              <Input
                id="horaMontajeInicio"
                type="time"
                value={formData.horaMontajeInicio || ""}
                onChange={(e) => setFormData({ ...formData, horaMontajeInicio: e.target.value })}
              />
              <Input
                type="time"
                value={formData.horaMontajeFin || ""}
                onChange={(e) => setFormData({ ...formData, horaMontajeFin: e.target.value })}
              />
            </div>
          </div>

          {/* Fecha Ejecucion Inicio */}
          <div className="space-y-2">
            <Label>Fecha Ejecución Inicio *</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button 
                  variant="outline" 
                  className={cn(
                    "w-full justify-start text-left font-normal", 
                    !ejecucionStart && "text-muted-foreground",
                    errors.ejecucionStart && "border-destructive"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {ejecucionStart ? format(ejecucionStart, "PPP", { locale: es }) : "Seleccionar"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar 
                  mode="single" 
                  selected={ejecucionStart} 
                  onSelect={(date) => {
                    setEjecucionStart(date);
                    if (errors.ejecucionStart) setErrors({ ...errors, ejecucionStart: undefined });
                  }} 
                  locale={es} 
                  className="pointer-events-auto" 
                />
              </PopoverContent>
            </Popover>
            {errors.ejecucionStart && <p className="text-sm text-destructive">{errors.ejecucionStart}</p>}
          </div>

          {/* Fecha Ejecucion Fin */}
          <div className="space-y-2">
            <Label>Fecha Ejecución Fin</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !ejecucionEnd && "text-muted-foreground")}>
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {ejecucionEnd ? format(ejecucionEnd, "PPP", { locale: es }) : "Seleccionar"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar mode="single" selected={ejecucionEnd} onSelect={setEjecucionEnd} locale={es} className="pointer-events-auto" />
              </PopoverContent>
            </Popover>
          </div>

          {/* Hora Ejecucion */}
          <div className="space-y-2">
            <Label htmlFor="horaEjecucionInicio">Hora Ejecución (Inicio - Fin)</Label>
            <div className="flex gap-2">
              <Input
                id="horaEjecucionInicio"
                type="time"
                value={formData.horaEjecucionInicio || ""}
                onChange={(e) => setFormData({ ...formData, horaEjecucionInicio: e.target.value })}
              />
              <Input
                type="time"
                value={formData.horaEjecucionFin || ""}
                onChange={(e) => setFormData({ ...formData, horaEjecucionFin: e.target.value })}
              />
            </div>
          </div>

          {/* Administrativo Responsable */}
          <div className="space-y-2">
            <Label htmlFor="administrativoResponsable">Administrativo Responsable</Label>
            <Input
              id="administrativoResponsable"
              placeholder="Nombre del responsable"
              value={formData.administrativoResponsable || ""}
              onChange={(e) => setFormData({ ...formData, administrativoResponsable: e.target.value })}
            />
          </div>

          {/* Ubicación */}
          <div className="space-y-2">
            <Label htmlFor="ubicacion">Ubicación *</Label>
            <Input
              id="ubicacion"
              placeholder="Lugar del evento"
              value={formData.ubicacion || ""}
              onChange={(e) => {
                setFormData({ ...formData, ubicacion: e.target.value });
                if (errors.ubicacion) setErrors({ ...errors, ubicacion: undefined });
              }}
              className={cn(errors.ubicacion && "border-destructive")}
            />
            {errors.ubicacion && <p className="text-sm text-destructive">{errors.ubicacion}</p>}
          </div>

          {/* Notas */}
          <div className="col-span-2 space-y-2">
            <Label htmlFor="notas">Notas</Label>
            <Textarea
              id="notas"
              placeholder="Notas adicionales..."
              value={formData.notas || ""}
              onChange={(e) => setFormData({ ...formData, notas: e.target.value })}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit}>
            <Plus className="h-4 w-4 mr-2" />
            Crear Proyecto
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
