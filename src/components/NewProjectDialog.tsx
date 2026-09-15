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
import { useAuth } from "@/contexts/AuthContext";
import { NuevoClienteInline } from "@/components/NuevoClienteInline";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { DateRange } from "react-day-picker";
import { TimeInputManual } from "@/components/TimeInputManual";

interface NewProjectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onProjectCreate: (project: Partial<Project>) => void;
}

interface ValidationErrors {
  cliente?: string;
  evento?: string;
  fechaMontaje?: string;
  fechaEjecucion?: string;
  ubicacion?: string;
}

// Componente para selector de rango de fechas
const DateRangePickerField = ({
  label,
  range,
  onRangeChange,
  error,
  required
}: {
  label: string;
  range: DateRange | undefined;
  onRangeChange: (range: DateRange | undefined) => void;
  error?: string;
  required?: boolean;
}) => {
  const [open, setOpen] = useState(false);
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;

  const formatDateRange = () => {
    if (!range?.from) return "Seleccionar rango";
    if (!range.to) return format(range.from, "d MMM yyyy", { locale: es });
    return `${format(range.from, "d MMM", { locale: es })} - ${format(range.to, "d MMM yyyy", { locale: es })}`;
  };

  return (
    <div className="space-y-2">
      <Label className={error ? "text-destructive" : ""}>
        {label} {required && <span className="text-destructive">*</span>}
      </Label>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            className={cn(
              "w-full justify-start text-left font-normal h-10",
              !range?.from && "text-muted-foreground",
              error && "border-destructive"
            )}
          >
            <CalendarIcon className="mr-2 h-4 w-4 shrink-0" />
            <span className="truncate">{formatDateRange()}</span>
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start" side="bottom">
          <Calendar
            mode="range"
            selected={range}
            onSelect={(newRange) => {
              onRangeChange(newRange);
              if (newRange?.from && newRange?.to) {
                setOpen(false);
              }
            }}
            numberOfMonths={isMobile ? 1 : 2}
            locale={es}
            className="pointer-events-auto"
          />
        </PopoverContent>
      </Popover>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
};

/** Valor reservado del selector para "crear cliente nuevo". */
const NUEVO_CLIENTE = "__nuevo_cliente__";

export function NewProjectDialog({
  open,
  onOpenChange,
  onProjectCreate,
}: NewProjectDialogProps) {
  const { clientes } = useClientes();
  const { role } = useAuth();
  // Solo los administradores pueden crear clientes (asi esta la regla en la base).
  const puedeCrearClientes = role === "administrador";
  const [creandoCliente, setCreandoCliente] = useState(false);
  const [formData, setFormData] = useState<Partial<Project>>({
    estado: "por_planear",
    horaMontajeInicio: "09:00",
    horaMontajeFin: "18:00",
    horaEjecucionInicio: "08:00",
    horaEjecucionFin: "22:00",
    horaDesmontajeInicio: "18:00",
    horaDesmontajeFin: "22:00",
  });
  const [montajeRange, setMontajeRange] = useState<DateRange | undefined>();
  const [ejecucionRange, setEjecucionRange] = useState<DateRange | undefined>();
  const [desmontajeRange, setDesmontajeRange] = useState<DateRange | undefined>();
  const [errors, setErrors] = useState<ValidationErrors>({});

  const validateForm = (): boolean => {
    const newErrors: ValidationErrors = {};
    
    logger.debug("[NewProjectDialog] Validating form:", {
      cliente: formData.cliente,
      evento: formData.evento,
      montajeRange,
      ejecucionRange,
      ubicacion: formData.ubicacion,
      clientesDisponibles: clientes.length
    });
    
    if (!formData.cliente) {
      newErrors.cliente = "Este campo es obligatorio";
    }
    if (!formData.evento?.trim()) {
      newErrors.evento = "Este campo es obligatorio";
    }
    // Permitimos proyectos de 1 solo día (inicio = fin). Si el usuario necesita un rango,
    // puede seleccionar una fecha de fin adicional.
    if (!montajeRange?.from) {
      newErrors.fechaMontaje = "Seleccione la fecha";
    }
    if (!ejecucionRange?.from) {
      newErrors.fechaEjecucion = "Seleccione la fecha";
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
      const missingFields = [];
      if (!formData.cliente) missingFields.push("Cliente");
      if (!formData.evento?.trim()) missingFields.push("Evento");
      if (!montajeRange?.from) missingFields.push("Fecha Montaje");
      if (!ejecucionRange?.from) missingFields.push("Fecha Ejecución");
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
      fechaMontajeInicio: montajeRange?.from ? format(montajeRange.from, "yyyy-MM-dd") : "",
      fechaMontajeFin: (montajeRange?.to || montajeRange?.from)
        ? format(montajeRange?.to || montajeRange?.from!, "yyyy-MM-dd")
        : "",
      fechaEjecucionInicio: ejecucionRange?.from ? format(ejecucionRange.from, "yyyy-MM-dd") : "",
      fechaEjecucionFin: (ejecucionRange?.to || ejecucionRange?.from)
        ? format(ejecucionRange?.to || ejecucionRange?.from!, "yyyy-MM-dd")
        : "",
      // Desmontaje is optional
      fechaDesmontajeInicio: desmontajeRange?.from ? format(desmontajeRange.from, "yyyy-MM-dd") : "",
      fechaDesmontajeFin: (desmontajeRange?.to || desmontajeRange?.from)
        ? format(desmontajeRange?.to || desmontajeRange?.from!, "yyyy-MM-dd")
        : "",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    onProjectCreate(newProject);
    
    // Reset form
    setFormData({ 
      estado: "por_planear",
      horaMontajeInicio: "09:00",
      horaMontajeFin: "18:00",
      horaEjecucionInicio: "08:00",
      horaEjecucionFin: "22:00",
      horaDesmontajeInicio: "18:00",
      horaDesmontajeFin: "22:00",
    });
    setMontajeRange(undefined);
    setEjecucionRange(undefined);
    setDesmontajeRange(undefined);
    setErrors({});
    setCreandoCliente(false);
    
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
      <DialogContent className={cn(
        "sm:max-w-2xl max-h-[90vh] flex flex-col overflow-hidden",
        "max-sm:fixed max-sm:inset-0 max-sm:max-w-full max-sm:max-h-full max-sm:w-full max-sm:h-[100dvh]",
        "max-sm:rounded-none max-sm:border-0 max-sm:p-0 max-sm:translate-x-0 max-sm:translate-y-0 max-sm:top-0 max-sm:left-0"
      )}>
        <div className="flex flex-col h-full overflow-hidden">
          <DialogHeader className={cn(
            "shrink-0",
            "max-sm:sticky max-sm:top-0 max-sm:z-10 max-sm:bg-background",
            "max-sm:pt-[calc(env(safe-area-inset-top)+12px)]",
            "max-sm:px-4 max-sm:pb-3 max-sm:border-b"
          )}>
            <DialogTitle className="flex items-center gap-2 text-base sm:text-lg">
              <Plus className="h-5 w-5" />
              Nuevo Proyecto
            </DialogTitle>
          </DialogHeader>

          <div className={cn(
            "flex-1 overflow-y-auto space-y-4 sm:space-y-6 py-4 px-1",
            "max-sm:overscroll-contain max-sm:touch-pan-y max-sm:[-webkit-overflow-scrolling:touch] max-sm:px-4 max-sm:pb-[calc(env(safe-area-inset-bottom)+16px)]"
          )}>
          {/* Información General */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
            <div className="space-y-2">
              <Label htmlFor="centroCostos">Centro de Costos</Label>
              <Input
                id="centroCostos"
                placeholder="Ej: 1-0006"
                value={formData.centroCostos || ""}
                onChange={(e) => setFormData({ ...formData, centroCostos: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="numFactura"># Factura</Label>
              <Input
                id="numFactura"
                placeholder="Ej: C-7014"
                value={formData.numFactura || ""}
                onChange={(e) => setFormData({ ...formData, numFactura: e.target.value })}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
            <div className="space-y-2">
              <Label htmlFor="cliente">Cliente *</Label>
              {creandoCliente ? (
                <NuevoClienteInline
                  onCreado={(nombre) => {
                    setFormData({ ...formData, cliente: nombre });
                    setErrors({ ...errors, cliente: undefined });
                    setCreandoCliente(false);
                  }}
                  onCancelar={() => setCreandoCliente(false)}
                />
              ) : (
                <Select
                  value={formData.cliente || ""}
                  onValueChange={(value) => {
                    if (value === NUEVO_CLIENTE) {
                      setCreandoCliente(true);
                      return;
                    }
                    setFormData({ ...formData, cliente: value });
                    if (errors.cliente) setErrors({ ...errors, cliente: undefined });
                  }}
                >
                  <SelectTrigger className={cn(errors.cliente && "border-destructive")}>
                    <SelectValue placeholder="Seleccionar cliente" />
                  </SelectTrigger>
                  <SelectContent>
                    {puedeCrearClientes && (
                      <SelectItem value={NUEVO_CLIENTE} className="font-medium">
                        <span className="flex items-center gap-1.5">
                          <Plus className="h-3.5 w-3.5" />
                          Crear cliente nuevo
                        </span>
                      </SelectItem>
                    )}
                    {clientes.length === 0 ? (
                      <div className="px-2 py-4 text-sm text-muted-foreground text-center">
                        {puedeCrearClientes
                          ? "Todavía no hay clientes. Créalo aquí mismo."
                          : "No hay clientes. Pídele a un administrador que lo cree."}
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
              )}
              {errors.cliente && <p className="text-sm text-destructive">{errors.cliente}</p>}
            </div>

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
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
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
          </div>

          {/* Sección Montaje */}
          <div className="rounded-lg border bg-muted/30 p-3 sm:p-4 space-y-3 sm:space-y-4">
            <h3 className="font-semibold text-sm text-foreground flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-blue-500"></span>
              MONTAJE
            </h3>
            
            <DateRangePickerField
              label="Fecha Montaje (Inicio - Fin)"
              range={montajeRange}
              onRangeChange={(range) => {
                setMontajeRange(range);
                if (errors.fechaMontaje) setErrors({ ...errors, fechaMontaje: undefined });
              }}
              error={errors.fechaMontaje}
              required
            />

            <div>
              <Label className="text-sm font-medium mb-2 sm:mb-3 block">Hora Montaje</Label>
              <div className="flex flex-wrap items-end gap-2 sm:gap-3">
                <TimeInputManual
                  label="Inicio"
                  value={formData.horaMontajeInicio || "09:00"}
                  onChange={(value) => setFormData({ ...formData, horaMontajeInicio: value })}
                />
                <span className="text-muted-foreground pb-2.5 hidden sm:inline">—</span>
                <TimeInputManual
                  label="Fin"
                  value={formData.horaMontajeFin || "18:00"}
                  onChange={(value) => setFormData({ ...formData, horaMontajeFin: value })}
                />
              </div>
            </div>
          </div>

          {/* Sección Ejecución */}
          <div className="rounded-lg border bg-muted/30 p-3 sm:p-4 space-y-3 sm:space-y-4">
            <h3 className="font-semibold text-sm text-foreground flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-green-500"></span>
              EJECUCIÓN
            </h3>
            
            <DateRangePickerField
              label="Fecha Ejecución (Inicio - Fin)"
              range={ejecucionRange}
              onRangeChange={(range) => {
                setEjecucionRange(range);
                if (errors.fechaEjecucion) setErrors({ ...errors, fechaEjecucion: undefined });
              }}
              error={errors.fechaEjecucion}
              required
            />

            <div>
              <Label className="text-sm font-medium mb-2 sm:mb-3 block">Hora Ejecución</Label>
              <div className="flex flex-wrap items-end gap-2 sm:gap-3">
                <TimeInputManual
                  label="Inicio"
                  value={formData.horaEjecucionInicio || "08:00"}
                  onChange={(value) => setFormData({ ...formData, horaEjecucionInicio: value })}
                />
                <span className="text-muted-foreground pb-2.5 hidden sm:inline">—</span>
                <TimeInputManual
                  label="Fin"
                  value={formData.horaEjecucionFin || "22:00"}
                  onChange={(value) => setFormData({ ...formData, horaEjecucionFin: value })}
                />
              </div>
            </div>
          </div>

          {/* Sección Desmontaje - Opcional */}
          <div className="rounded-lg border bg-muted/30 p-3 sm:p-4 space-y-3 sm:space-y-4">
            <h3 className="font-semibold text-sm text-foreground flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-gantt-desmontaje"></span>
              DESMONTAJE
              <span className="text-xs font-normal text-muted-foreground">(Opcional)</span>
            </h3>
            
            <DateRangePickerField
              label="Fecha Desmontaje (Inicio - Fin)"
              range={desmontajeRange}
              onRangeChange={(range) => {
                setDesmontajeRange(range);
              }}
            />

            <div>
              <Label className="text-sm font-medium mb-2 sm:mb-3 block">Hora Desmontaje</Label>
              <div className="flex flex-wrap items-end gap-2 sm:gap-3">
                <TimeInputManual
                  label="Inicio"
                  value={formData.horaDesmontajeInicio || "18:00"}
                  onChange={(value) => setFormData({ ...formData, horaDesmontajeInicio: value })}
                />
                <span className="text-muted-foreground pb-2.5 hidden sm:inline">—</span>
                <TimeInputManual
                  label="Fin"
                  value={formData.horaDesmontajeFin || "22:00"}
                  onChange={(value) => setFormData({ ...formData, horaDesmontajeFin: value })}
                />
              </div>
            </div>
          </div>

          {/* Información Adicional */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
            <div className="space-y-2">
              <Label htmlFor="administrativoResponsable">Administrativo Responsable</Label>
              <Input
                id="administrativoResponsable"
                placeholder="Nombre del responsable"
                value={formData.administrativoResponsable || ""}
                onChange={(e) => setFormData({ ...formData, administrativoResponsable: e.target.value })}
              />
            </div>

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
          </div>

          <div className="space-y-2">
            <Label htmlFor="notas">Notas</Label>
            <Textarea
              id="notas"
              placeholder="Notas adicionales..."
              value={formData.notas || ""}
              onChange={(e) => setFormData({ ...formData, notas: e.target.value })}
            />
          </div>
          </div>

          <DialogFooter className={cn(
            "shrink-0 flex-col sm:flex-row gap-2 sm:gap-0 pt-4 border-t mt-2",
            "max-sm:sticky max-sm:bottom-0 max-sm:bg-background",
            "max-sm:pb-[calc(env(safe-area-inset-bottom)+12px)]",
            "max-sm:px-4 max-sm:pt-3"
          )}>
            <Button variant="outline" onClick={() => handleOpenChange(false)} className="w-full sm:w-auto">
              Cancelar
            </Button>
            <Button onClick={handleSubmit} className="w-full sm:w-auto">
              <Plus className="h-4 w-4 mr-2" />
              Crear Proyecto
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}
