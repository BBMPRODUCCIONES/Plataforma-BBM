import { useState } from "react";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { CalendarIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Label } from "@/components/ui/label";
import { TimeInputManual } from "@/components/TimeInputManual";

interface DateTimeRange {
  fechaInicio: string;
  fechaFin: string;
  horaInicio?: string;
  horaFin?: string;
}

interface DateTimeRangeEditorProps {
  type: "montaje" | "ejecucion" | "desmontaje";
  value: DateTimeRange;
  onChange: (value: DateTimeRange) => void;
  displayValue: React.ReactNode;
}

export function DateTimeRangeEditor({
  type,
  value,
  onChange,
  displayValue,
}: DateTimeRangeEditorProps) {
  const [open, setOpen] = useState(false);
  const [localValue, setLocalValue] = useState<DateTimeRange>(value);

  const handleOpen = () => {
    setLocalValue(value);
    setOpen(true);
  };

  const handleSave = () => {
    onChange(localValue);
    setOpen(false);
  };

  const title = type === "montaje" ? "Fecha de Montaje" : type === "ejecucion" ? "Fecha de Ejecución" : "Fecha de Desmontaje";
  const colorClass = type === "montaje" ? "bg-gantt-montaje" : type === "ejecucion" ? "bg-gantt-ejecucion" : "bg-gantt-desmontaje";

  return (
    <>
      <button
        onClick={(e) => {
          e.stopPropagation();
          handleOpen();
        }}
        className="text-left hover:bg-muted/50 rounded px-1 py-0.5 transition-colors w-full"
      >
        {displayValue}
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-[500px]" onClick={(e) => e.stopPropagation()}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <div className={cn("w-3 h-3 rounded-sm", colorClass)} />
              {title}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-6 py-4">
            {/* Fecha Range */}
            <div className="space-y-3">
              <Label className="text-sm font-medium">Rango de Fechas</Label>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">Desde</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full justify-start text-left font-normal",
                          !localValue.fechaInicio && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {localValue.fechaInicio
                          ? format(parseISO(localValue.fechaInicio), "dd/MM/yyyy", { locale: es })
                          : "Seleccionar"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={localValue.fechaInicio ? parseISO(localValue.fechaInicio) : undefined}
                        onSelect={(date) => {
                          if (date) {
                            setLocalValue({
                              ...localValue,
                              fechaInicio: format(date, "yyyy-MM-dd"),
                            });
                          }
                        }}
                        initialFocus
                        className="p-3 pointer-events-auto"
                        locale={es}
                      />
                    </PopoverContent>
                  </Popover>
                </div>

                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">Hasta</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full justify-start text-left font-normal",
                          !localValue.fechaFin && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {localValue.fechaFin
                          ? format(parseISO(localValue.fechaFin), "dd/MM/yyyy", { locale: es })
                          : "Seleccionar"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={localValue.fechaFin ? parseISO(localValue.fechaFin) : undefined}
                        onSelect={(date) => {
                          if (date) {
                            setLocalValue({
                              ...localValue,
                              fechaFin: format(date, "yyyy-MM-dd"),
                            });
                          }
                        }}
                        initialFocus
                        className="p-3 pointer-events-auto"
                        locale={es}
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              </div>
            </div>

            {/* Hora Range */}
            <div className="space-y-3">
              <Label className="text-sm font-medium">Rango de Horas</Label>
              <div className="grid grid-cols-2 gap-4">
                <TimeInputManual
                  label="Desde"
                  value={localValue.horaInicio || "09:00"}
                  onChange={(value) =>
                    setLocalValue({ ...localValue, horaInicio: value })
                  }
                />
                <TimeInputManual
                  label="Hasta"
                  value={localValue.horaFin || "18:00"}
                  onChange={(value) =>
                    setLocalValue({ ...localValue, horaFin: value })
                  }
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSave}>Guardar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
