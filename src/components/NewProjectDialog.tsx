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
import { DateRange } from "react-day-picker";

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

// Componente para input de hora manual con AM/PM
const TimeInputManual = ({ 
  value, 
  onChange, 
  label 
}: { 
  value: string; 
  onChange: (value: string) => void;
  label: string;
}) => {
  // Parse existing value (expected format: "HH:MM" in 24h)
  const parseTime = (timeStr: string) => {
    if (!timeStr) return { hours: "09", minutes: "00", period: "AM" };
    const [h, m] = timeStr.split(":");
    let hours = parseInt(h) || 0;
    const minutes = m || "00";
    const period = hours >= 12 ? "PM" : "AM";
    if (hours > 12) hours -= 12;
    if (hours === 0) hours = 12;
    return { 
      hours: hours.toString().padStart(2, "0"), 
      minutes: minutes.padStart(2, "0"), 
      period 
    };
  };

  const { hours, minutes, period } = parseTime(value);

  const handleChange = (newHours: string, newMinutes: string, newPeriod: string) => {
    let h = parseInt(newHours) || 0;
    if (newPeriod === "PM" && h !== 12) h += 12;
    if (newPeriod === "AM" && h === 12) h = 0;
    const formatted = `${h.toString().padStart(2, "0")}:${newMinutes.padStart(2, "0")}`;
    onChange(formatted);
  };

  return (
    <div className="space-y-1">
      <span className="text-xs text-muted-foreground">{label}</span>
      <div className="flex items-center gap-1">
        <Input
          type="text"
          value={hours}
          onChange={(e) => {
            const val = e.target.value.replace(/\D/g, "").slice(0, 2);
            const num = parseInt(val) || 0;
            if (num >= 1 && num <= 12) {
              handleChange(val, minutes, period);
            } else if (val === "" || val === "0") {
              handleChange("12", minutes, period);
            }
          }}
          className="w-11 text-center px-1 h-9"
          placeholder="HH"
          maxLength={2}
        />
        <span className="text-muted-foreground font-medium">:</span>
        <Input
          type="text"
          value={minutes}
          onChange={(e) => {
            const val = e.target.value.replace(/\D/g, "").slice(0, 2);
            const num = parseInt(val) || 0;
            if (num >= 0 && num <= 59) {
              handleChange(hours, val.padStart(2, "0"), period);
            }
          }}
          className="w-11 text-center px-1 h-9"
          placeholder="MM"
          maxLength={2}
        />
        <Select
          value={period}
          onValueChange={(newPeriod) => handleChange(hours, minutes, newPeriod)}
        >
          <SelectTrigger className="w-[70px] h-9">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="AM">AM</SelectItem>
            <SelectItem value="PM">PM</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );
};

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

export function NewProjectDialog({
  open,
  onOpenChange,
  onProjectCreate,
}: NewProjectDialogProps) {
  const { clientes } = useClientes();
  const [formData, setFormData] = useState<Partial<Project>>({
    estado: "por_planear",
    horaMontajeInicio: "09:00",
    horaMontajeFin: "18:00",
    horaEjecucionInicio: "08:00",
    horaEjecucionFin: "22:00",
  });
  const [montajeRange, setMontajeRange] = useState<DateRange | undefined>();
  const [ejecucionRange, setEjecucionRange] = useState<DateRange | undefined>();
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
    if (!montajeRange?.from || !montajeRange?.to) {
      newErrors.fechaMontaje = "Seleccione el rango de fechas";
    }
    if (!ejecucionRange?.from || !ejecucionRange?.to) {
      newErrors.fechaEjecucion = "Seleccione el rango de fechas";
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
      if (!montajeRange?.from || !montajeRange?.to) missingFields.push("Fecha Montaje");
      if (!ejecucionRange?.from || !ejecucionRange?.to) missingFields.push("Fecha Ejecución");
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
      fechaMontajeFin: montajeRange?.to ? format(montajeRange.to, "yyyy-MM-dd") : "",
      fechaEjecucionInicio: ejecucionRange?.from ? format(ejecucionRange.from, "yyyy-MM-dd") : "",
      fechaEjecucionFin: ejecucionRange?.to ? format(ejecucionRange.to, "yyyy-MM-dd") : "",
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
    });
    setMontajeRange(undefined);
    setEjecucionRange(undefined);
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
      <DialogContent className={cn(
        "sm:max-w-2xl max-h-[90vh] overflow-hidden",
        "max-sm:fixed max-sm:inset-0 max-sm:max-w-full max-sm:max-h-full max-sm:w-full max-sm:h-[100dvh]",
        "max-sm:rounded-none max-sm:border-0 max-sm:p-0 max-sm:translate-x-0 max-sm:translate-y-0 max-sm:top-0 max-sm:left-0"
      )}>
        <div className="sm:contents max-sm:flex max-sm:flex-col max-sm:h-full max-sm:overflow-hidden">
          <DialogHeader className={cn(
            "max-sm:sticky max-sm:top-0 max-sm:z-10 max-sm:bg-background",
            "max-sm:pt-[calc(env(safe-area-inset-top)+12px)]",
            "max-sm:px-4 max-sm:pb-3 max-sm:border-b max-sm:shrink-0"
          )}>
            <DialogTitle className="flex items-center gap-2 text-base sm:text-lg">
              <Plus className="h-5 w-5" />
              Nuevo Proyecto
            </DialogTitle>
          </DialogHeader>

          <div className={cn(
            "space-y-4 sm:space-y-6 py-2 sm:py-4 sm:overflow-y-auto sm:max-h-[calc(90vh-140px)]",
            "max-sm:flex-1 max-sm:overflow-y-auto max-sm:overscroll-contain max-sm:px-4 max-sm:py-4",
            "max-sm:min-h-0"
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
            "flex-col sm:flex-row gap-2 sm:gap-0",
            "max-sm:sticky max-sm:bottom-0 max-sm:bg-background max-sm:shrink-0",
            "max-sm:pb-[calc(env(safe-area-inset-bottom)+12px)]",
            "max-sm:px-4 max-sm:pt-3 max-sm:border-t"
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
