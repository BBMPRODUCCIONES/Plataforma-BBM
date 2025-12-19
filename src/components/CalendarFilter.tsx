import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CalendarIcon, ChevronLeft, ChevronRight, CalendarRange, X } from "lucide-react";
import { 
  format, 
  addDays, 
  addWeeks, 
  addMonths, 
  addYears, 
  startOfWeek, 
  endOfWeek, 
  startOfMonth, 
  endOfMonth,
  startOfQuarter,
  endOfQuarter,
  startOfYear,
  endOfYear,
  addQuarters
} from "date-fns";
import { es } from "date-fns/locale";
import { CalendarViewMode, ProjectStatus } from "@/types";
import { cn } from "@/lib/utils";
import { DateRange } from "react-day-picker";

interface CalendarFilterProps {
  viewMode: CalendarViewMode;
  selectedDate: Date;
  dateRange?: { start: Date; end: Date };
  statusFilter: ProjectStatus | "todos";
  onViewModeChange: (mode: CalendarViewMode) => void;
  onDateChange: (date: Date) => void;
  onDateRangeChange?: (range: { start: Date; end: Date } | undefined) => void;
  onStatusChange: (status: ProjectStatus | "todos") => void;
}

const STATUS_OPTIONS: { value: ProjectStatus | "todos"; label: string }[] = [
  { value: "todos", label: "Todos los estados" },
  { value: "por_planear", label: "Por Planear" },
  { value: "por_ejecutar", label: "Por Ejecutar" },
  { value: "en_progreso", label: "En Progreso" },
  { value: "terminado", label: "Terminado" },
  { value: "facturado", label: "Facturado" },
];

const VIEW_MODE_LABELS: Record<CalendarViewMode, string> = {
  day: "Día",
  week: "Semana",
  month: "Mes",
  quarter: "Trimestre",
  year: "Año",
  custom: "Rango",
};

export function CalendarFilter({
  viewMode,
  selectedDate,
  dateRange,
  statusFilter,
  onViewModeChange,
  onDateChange,
  onDateRangeChange,
  onStatusChange,
}: CalendarFilterProps) {
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [rangePickerOpen, setRangePickerOpen] = useState(false);
  const [tempRange, setTempRange] = useState<DateRange | undefined>(
    dateRange ? { from: dateRange.start, to: dateRange.end } : undefined
  );

  // Sincronizar tempRange cuando dateRange (del contexto global) cambia
  useEffect(() => {
    if (dateRange) {
      setTempRange({ from: dateRange.start, to: dateRange.end });
    }
  }, [dateRange?.start?.getTime(), dateRange?.end?.getTime()]);

  const getDateRangeLabel = () => {
    if (viewMode === "custom" && dateRange) {
      return `${format(dateRange.start, "d MMM", { locale: es })} - ${format(dateRange.end, "d MMM yyyy", { locale: es })}`;
    }
    
    switch (viewMode) {
      case "day":
        return format(selectedDate, "EEEE, d 'de' MMMM yyyy", { locale: es });
      case "week":
        const weekStart = startOfWeek(selectedDate, { weekStartsOn: 1 });
        const weekEnd = endOfWeek(selectedDate, { weekStartsOn: 1 });
        return `${format(weekStart, "d MMM", { locale: es })} - ${format(weekEnd, "d MMM yyyy", { locale: es })}`;
      case "month":
        return format(selectedDate, "MMMM yyyy", { locale: es });
      case "quarter":
        const qStart = startOfQuarter(selectedDate);
        const qEnd = endOfQuarter(selectedDate);
        const quarterNum = Math.floor(selectedDate.getMonth() / 3) + 1;
        return `Q${quarterNum} ${selectedDate.getFullYear()} (${format(qStart, "MMM", { locale: es })} - ${format(qEnd, "MMM", { locale: es })})`;
      case "year":
        return format(selectedDate, "yyyy", { locale: es });
      default:
        return "";
    }
  };

  const navigatePrevious = () => {
    switch (viewMode) {
      case "day":
        onDateChange(addDays(selectedDate, -1));
        break;
      case "week":
        onDateChange(addWeeks(selectedDate, -1));
        break;
      case "month":
        onDateChange(addMonths(selectedDate, -1));
        break;
      case "quarter":
        onDateChange(addQuarters(selectedDate, -1));
        break;
      case "year":
        onDateChange(addYears(selectedDate, -1));
        break;
      case "custom":
        // For custom, move range back by its duration
        if (dateRange) {
          const duration = Math.ceil((dateRange.end.getTime() - dateRange.start.getTime()) / (1000 * 60 * 60 * 24));
          const newStart = addDays(dateRange.start, -duration - 1);
          const newEnd = addDays(dateRange.end, -duration - 1);
          onDateRangeChange?.({ start: newStart, end: newEnd });
        }
        break;
    }
  };

  const navigateNext = () => {
    switch (viewMode) {
      case "day":
        onDateChange(addDays(selectedDate, 1));
        break;
      case "week":
        onDateChange(addWeeks(selectedDate, 1));
        break;
      case "month":
        onDateChange(addMonths(selectedDate, 1));
        break;
      case "quarter":
        onDateChange(addQuarters(selectedDate, 1));
        break;
      case "year":
        onDateChange(addYears(selectedDate, 1));
        break;
      case "custom":
        // For custom, move range forward by its duration
        if (dateRange) {
          const duration = Math.ceil((dateRange.end.getTime() - dateRange.start.getTime()) / (1000 * 60 * 60 * 24));
          const newStart = addDays(dateRange.start, duration + 1);
          const newEnd = addDays(dateRange.end, duration + 1);
          onDateRangeChange?.({ start: newStart, end: newEnd });
        }
        break;
    }
  };

  const goToToday = () => {
    onDateChange(new Date());
    if (viewMode === "custom") {
      onDateRangeChange?.({ start: new Date(), end: new Date() });
    }
  };

  const handleViewModeChange = (mode: CalendarViewMode) => {
    onViewModeChange(mode);
    if (mode === "custom") {
      // Open range picker when switching to custom mode
      setRangePickerOpen(true);
    }
  };

  const handleRangeSelect = (range: DateRange | undefined) => {
    setTempRange(range);
  };

  const applyRange = () => {
    if (tempRange?.from && tempRange?.to) {
      onDateRangeChange?.({ start: tempRange.from, end: tempRange.to });
      setRangePickerOpen(false);
    }
  };

  const applyPreset = (preset: "thisWeek" | "thisMonth" | "thisQuarter" | "thisYear" | "last7" | "last30" | "last90") => {
    const today = new Date();
    let start: Date;
    let end: Date;

    switch (preset) {
      case "thisWeek":
        start = startOfWeek(today, { weekStartsOn: 1 });
        end = endOfWeek(today, { weekStartsOn: 1 });
        break;
      case "thisMonth":
        start = startOfMonth(today);
        end = endOfMonth(today);
        break;
      case "thisQuarter":
        start = startOfQuarter(today);
        end = endOfQuarter(today);
        break;
      case "thisYear":
        start = startOfYear(today);
        end = endOfYear(today);
        break;
      case "last7":
        start = addDays(today, -6);
        end = today;
        break;
      case "last30":
        start = addDays(today, -29);
        end = today;
        break;
      case "last90":
        start = addDays(today, -89);
        end = today;
        break;
    }

    onViewModeChange("custom");
    onDateRangeChange?.({ start, end });
    setTempRange({ from: start, to: end });
    setRangePickerOpen(false);
  };

  return (
    <div className="flex flex-wrap items-center gap-2 sm:gap-3 p-2 sm:p-3 bg-card border border-border rounded-lg calendar-filter-container">
      {/* View Mode Tabs */}
      <div className="flex items-center bg-muted rounded-md p-0.5 overflow-x-auto">
        {(["day", "week", "month", "quarter", "year"] as CalendarViewMode[]).map((mode) => (
          <Button
            key={mode}
            variant="ghost"
            size="sm"
            className={cn(
              "h-8 sm:h-7 px-2 sm:px-2.5 text-xs rounded-sm touch-manipulation flex-shrink-0",
              viewMode === mode && "bg-background shadow-sm"
            )}
            onClick={() => handleViewModeChange(mode)}
          >
            {VIEW_MODE_LABELS[mode]}
          </Button>
        ))}
      </div>

      {/* Custom Range Button */}
      <Popover open={rangePickerOpen} onOpenChange={setRangePickerOpen}>
        <PopoverTrigger asChild>
          <Button
            variant={viewMode === "custom" ? "default" : "outline"}
            size="sm"
            className={cn(
              "h-7 px-3 text-xs gap-1.5",
              viewMode === "custom" && "bg-primary text-primary-foreground"
            )}
            onClick={() => {
              handleViewModeChange("custom");
              setRangePickerOpen(true);
            }}
          >
            <CalendarRange className="h-3.5 w-3.5" />
            Rango
          </Button>
        </PopoverTrigger>
        <PopoverContent 
          className="w-auto p-0 bg-popover border border-border shadow-lg z-50" 
          align="start"
          sideOffset={4}
          avoidCollisions={true}
        >
          <div className="flex flex-col">
            {/* Header con rango seleccionado y botón Aplicar - SIEMPRE VISIBLE */}
            <div className="flex items-center justify-between p-3 border-b border-border bg-muted/50">
              <div className="text-xs text-muted-foreground">
                {tempRange?.from && tempRange?.to ? (
                  <span className="font-medium text-foreground">
                    {format(tempRange.from, "d MMM yyyy", { locale: es })} - {format(tempRange.to, "d MMM yyyy", { locale: es })}
                  </span>
                ) : (
                  <span>Selecciona un rango de fechas</span>
                )}
              </div>
              <Button size="sm" className="h-7 text-xs ml-4" onClick={applyRange} disabled={!tempRange?.from || !tempRange?.to}>
                Aplicar
              </Button>
            </div>
            
            {/* Contenido con presets y calendario */}
            <div className="flex max-h-[60vh] overflow-hidden">
              {/* Presets */}
              <div className="border-r border-border p-3 space-y-1 min-w-[140px] overflow-y-auto">
                <p className="text-xs font-semibold text-muted-foreground mb-2">Presets</p>
                <Button variant="ghost" size="sm" className="w-full justify-start text-xs h-7" onClick={() => applyPreset("last7")}>
                  Últimos 7 días
                </Button>
                <Button variant="ghost" size="sm" className="w-full justify-start text-xs h-7" onClick={() => applyPreset("last30")}>
                  Últimos 30 días
                </Button>
                <Button variant="ghost" size="sm" className="w-full justify-start text-xs h-7" onClick={() => applyPreset("last90")}>
                  Últimos 90 días
                </Button>
                <div className="border-t border-border my-2" />
                <Button variant="ghost" size="sm" className="w-full justify-start text-xs h-7" onClick={() => applyPreset("thisWeek")}>
                  Esta semana
                </Button>
                <Button variant="ghost" size="sm" className="w-full justify-start text-xs h-7" onClick={() => applyPreset("thisMonth")}>
                  Este mes
                </Button>
                <Button variant="ghost" size="sm" className="w-full justify-start text-xs h-7" onClick={() => applyPreset("thisQuarter")}>
                  Este trimestre
                </Button>
                <Button variant="ghost" size="sm" className="w-full justify-start text-xs h-7" onClick={() => applyPreset("thisYear")}>
                  Este año
                </Button>
              </div>
              {/* Calendar */}
              <div className="p-3 overflow-y-auto">
                <Calendar
                  mode="range"
                  selected={tempRange}
                  onSelect={handleRangeSelect}
                  numberOfMonths={2}
                  locale={es}
                  className="pointer-events-auto"
                />
              </div>
            </div>
          </div>
        </PopoverContent>
      </Popover>

      {/* Navigation */}
      <div className="flex items-center gap-1 flex-shrink-0">
        <Button variant="outline" size="icon" className="h-8 w-8 sm:h-7 sm:w-7 touch-manipulation" onClick={navigatePrevious}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="h-8 sm:h-7 px-2 sm:px-3 min-w-[140px] sm:min-w-[200px] justify-start text-xs touch-manipulation">
              <CalendarIcon className="h-3 w-3 mr-1 sm:mr-2 flex-shrink-0" />
              <span className="capitalize truncate">{getDateRangeLabel()}</span>
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0 bg-popover border border-border shadow-lg z-50" align="start">
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={(date) => {
                if (date) {
                  onDateChange(date);
                  setCalendarOpen(false);
                }
              }}
              locale={es}
              className="pointer-events-auto"
            />
          </PopoverContent>
        </Popover>
        <Button variant="outline" size="icon" className="h-8 w-8 sm:h-7 sm:w-7 touch-manipulation" onClick={navigateNext}>
          <ChevronRight className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="sm" className="h-8 sm:h-7 px-2 text-xs touch-manipulation" onClick={goToToday}>
          Hoy
        </Button>
      </div>

      {/* Status Filter */}
      <Select value={statusFilter} onValueChange={(v) => onStatusChange(v as ProjectStatus | "todos")}>
        <SelectTrigger className="w-[130px] sm:w-[160px] h-8 sm:h-7 text-xs bg-background touch-manipulation flex-shrink-0">
          <SelectValue placeholder="Estado" />
        </SelectTrigger>
        <SelectContent className="bg-popover border border-border shadow-lg z-50">
          {STATUS_OPTIONS.map((option) => (
            <SelectItem key={option.value} value={option.value} className="touch-manipulation">
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Clear Filter Button - only show when custom range is active */}
      {viewMode === "custom" && dateRange && (
        <Button 
          variant="ghost" 
          size="sm" 
          className="h-7 px-2 text-xs text-muted-foreground hover:text-destructive gap-1"
          onClick={() => {
            onViewModeChange("month");
            onDateRangeChange?.(undefined);
            setTempRange(undefined);
          }}
        >
          <X className="h-3 w-3" />
          Limpiar
        </Button>
      )}
    </div>
  );
}