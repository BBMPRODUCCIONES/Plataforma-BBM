import { useState } from "react";
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
import { CalendarIcon, ChevronLeft, ChevronRight } from "lucide-react";
import { format, addDays, addWeeks, addMonths, addYears, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from "date-fns";
import { es } from "date-fns/locale";
import { CalendarViewMode, ProjectStatus } from "@/types";
import { cn } from "@/lib/utils";

interface CalendarFilterProps {
  viewMode: CalendarViewMode;
  selectedDate: Date;
  statusFilter: ProjectStatus | "todos";
  onViewModeChange: (mode: CalendarViewMode) => void;
  onDateChange: (date: Date) => void;
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

export function CalendarFilter({
  viewMode,
  selectedDate,
  statusFilter,
  onViewModeChange,
  onDateChange,
  onStatusChange,
}: CalendarFilterProps) {
  const [calendarOpen, setCalendarOpen] = useState(false);

  const getDateRangeLabel = () => {
    switch (viewMode) {
      case "day":
        return format(selectedDate, "EEEE, d 'de' MMMM yyyy", { locale: es });
      case "week":
        const weekStart = startOfWeek(selectedDate, { weekStartsOn: 1 });
        const weekEnd = endOfWeek(selectedDate, { weekStartsOn: 1 });
        return `${format(weekStart, "d MMM", { locale: es })} - ${format(weekEnd, "d MMM yyyy", { locale: es })}`;
      case "month":
        return format(selectedDate, "MMMM yyyy", { locale: es });
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
      case "year":
        onDateChange(addYears(selectedDate, -1));
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
      case "year":
        onDateChange(addYears(selectedDate, 1));
        break;
    }
  };

  const goToToday = () => {
    onDateChange(new Date());
  };

  return (
    <div className="flex flex-wrap items-center gap-3 p-3 bg-card border border-border rounded-lg">
      {/* View Mode Tabs */}
      <div className="flex items-center bg-muted rounded-md p-0.5">
        {(["day", "week", "month", "year"] as CalendarViewMode[]).map((mode) => (
          <Button
            key={mode}
            variant="ghost"
            size="sm"
            className={cn(
              "h-7 px-3 text-xs rounded-sm",
              viewMode === mode && "bg-background shadow-sm"
            )}
            onClick={() => onViewModeChange(mode)}
          >
            {mode === "day" ? "Día" : mode === "week" ? "Semana" : mode === "month" ? "Mes" : "Año"}
          </Button>
        ))}
      </div>

      {/* Navigation */}
      <div className="flex items-center gap-1">
        <Button variant="outline" size="icon" className="h-7 w-7" onClick={navigatePrevious}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="h-7 px-3 min-w-[200px] justify-start text-xs">
              <CalendarIcon className="h-3 w-3 mr-2" />
              <span className="capitalize">{getDateRangeLabel()}</span>
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
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
        <Button variant="outline" size="icon" className="h-7 w-7" onClick={navigateNext}>
          <ChevronRight className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={goToToday}>
          Hoy
        </Button>
      </div>

      {/* Status Filter */}
      <Select value={statusFilter} onValueChange={(v) => onStatusChange(v as ProjectStatus | "todos")}>
        <SelectTrigger className="w-[160px] h-7 text-xs">
          <SelectValue placeholder="Estado" />
        </SelectTrigger>
        <SelectContent>
          {STATUS_OPTIONS.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
