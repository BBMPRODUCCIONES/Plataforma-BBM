import { useState, useEffect } from "react";
import { useIsMobile } from "@/hooks/use-mobile";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import * as DialogPrimitive from "@radix-ui/react-dialog";
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
  const isMobileBreakpoint = useIsMobile();
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [rangePickerOpen, setRangePickerOpen] = useState(false);
  const [tempRange, setTempRange] = useState<DateRange | undefined>(
    dateRange ? { from: dateRange.start, to: dateRange.end } : undefined
  );
  const [isLandscape, setIsLandscape] = useState(false);
  const [isTouchDevice, setIsTouchDevice] = useState(false);

  // Detectar si es dispositivo táctil (más confiable que solo breakpoint)
  useEffect(() => {
    const checkTouch = () => {
      const coarse = window.matchMedia("(hover: none) and (pointer: coarse)").matches;
      setIsTouchDevice(coarse);
    };
    checkTouch();
    // También escuchar cambios (en caso de conectar/desconectar)
    const mql = window.matchMedia("(hover: none) and (pointer: coarse)");
    mql.addEventListener("change", checkTouch);
    return () => mql.removeEventListener("change", checkTouch);
  }, []);

  // Detectar orientación usando matchMedia (más robusto)
  useEffect(() => {
    const checkOrientation = () => {
      const landscapeMql = window.matchMedia("(orientation: landscape)");
      setIsLandscape(landscapeMql.matches);
    };
    checkOrientation();
    const mql = window.matchMedia("(orientation: landscape)");
    mql.addEventListener("change", checkOrientation);
    window.addEventListener("resize", checkOrientation);
    return () => {
      mql.removeEventListener("change", checkOrientation);
      window.removeEventListener("resize", checkOrientation);
    };
  }, []);

  // Móvil "real": breakpoint móvil O dispositivo táctil
  const isMobileLike = isMobileBreakpoint || isTouchDevice;

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
      {/* View Mode Tabs - horizontal scroll on mobile */}
      <div className="flex items-center bg-muted rounded-md p-0.5 overflow-x-auto max-w-full scrollbar-thin">
        {(["day", "week", "month", "quarter", "year"] as CalendarViewMode[]).map((mode) => (
          <Button
            key={mode}
            variant="ghost"
            size="sm"
            className={cn(
              "h-10 sm:h-7 px-3 sm:px-2.5 text-xs rounded-sm touch-manipulation flex-shrink-0 min-w-[44px]",
              viewMode === mode && "bg-background shadow-sm"
            )}
            onClick={() => handleViewModeChange(mode)}
          >
            {VIEW_MODE_LABELS[mode]}
          </Button>
        ))}
      </div>

      {/* Custom Range Button - Mobile uses centered Dialog, Desktop uses Popover */}
      {isMobileLike ? (
        <>
          <Button
            variant={viewMode === "custom" ? "default" : "outline"}
            size="sm"
            className={cn(
              "h-10 sm:h-7 px-3 text-xs gap-1.5 touch-manipulation min-w-[44px]",
              viewMode === "custom" && "bg-primary text-primary-foreground"
            )}
            onClick={() => {
              handleViewModeChange("custom");
              setRangePickerOpen(true);
            }}
          >
            <CalendarRange className="h-4 w-4 sm:h-3.5 sm:w-3.5" />
          </Button>
          
          {/* Dialog centrado para móvil (portrait y landscape) */}
          <DialogPrimitive.Root open={rangePickerOpen} onOpenChange={setRangePickerOpen}>
            <DialogPrimitive.Portal>
              {/* Overlay + Contenedor centrado */}
              <div 
                className="fixed inset-0 z-50 flex items-center justify-center"
                style={{
                  paddingTop: "calc(env(safe-area-inset-top, 0px) + 12px)",
                  paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 12px)",
                  paddingLeft: "12px",
                  paddingRight: "12px",
                }}
              >
                {/* Overlay oscuro */}
                <DialogPrimitive.Overlay className="absolute inset-0 bg-black/70 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
                
                {/* Content centrado */}
                <DialogPrimitive.Content
                  key={`range-dialog-${isLandscape ? "land" : "port"}`}
                  className={cn(
                    "relative bg-popover border border-border rounded-lg shadow-lg overflow-hidden",
                    "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
                    "data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
                    "flex flex-col",
                    isLandscape 
                      ? "w-[min(98vw,850px)] max-h-[calc(100dvh-env(safe-area-inset-top,0px)-env(safe-area-inset-bottom,0px)-24px)]"
                      : "w-[min(95vw,360px)] max-h-[calc(100dvh-env(safe-area-inset-top,0px)-env(safe-area-inset-bottom,0px)-24px)]"
                  )}
                >
                  {/* Header fijo */}
                  <div className="flex items-center justify-between p-2 pr-1 border-b border-border bg-muted/50 flex-shrink-0">
                    <p className="text-xs font-medium">
                      {tempRange?.from && tempRange?.to ? (
                        <span className="text-foreground">
                          {format(tempRange.from, "d MMM", { locale: es })} - {format(tempRange.to, "d MMM yyyy", { locale: es })}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">Selecciona un rango</span>
                      )}
                    </p>
                    <DialogPrimitive.Close className="rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 touch-manipulation min-h-[44px] min-w-[44px] flex items-center justify-center">
                      <X className="h-5 w-5" />
                      <span className="sr-only">Cerrar</span>
                    </DialogPrimitive.Close>
                  </div>
                  
                  {/* Body scrollable */}
                  <div className="flex-1 overflow-auto">
                    {isLandscape ? (
                      /* Layout Landscape: Presets compactos izquierda + 2 calendarios más pequeños */
                      <div className="flex h-full">
                        <div className="border-r border-border px-0.5 py-1 space-y-0.5 flex-shrink-0">
                          <Button 
                            size="sm" 
                            variant="ghost" 
                            className="w-full justify-start h-6 px-1 text-[9px] whitespace-nowrap touch-manipulation"
                            onClick={() => applyPreset("thisWeek")}
                          >
                            Esta semana
                          </Button>
                          <Button 
                            size="sm" 
                            variant="ghost" 
                            className="w-full justify-start h-6 px-1 text-[9px] whitespace-nowrap touch-manipulation"
                            onClick={() => applyPreset("thisMonth")}
                          >
                            Este mes
                          </Button>
                          <Button 
                            size="sm" 
                            variant="ghost" 
                            className="w-full justify-start h-6 px-1 text-[9px] whitespace-nowrap touch-manipulation"
                            onClick={() => applyPreset("thisQuarter")}
                          >
                            Este trimestre
                          </Button>
                        </div>
                        <div className="p-1 overflow-auto flex-1 flex justify-center items-start">
                          <Calendar
                            mode="range"
                            selected={tempRange}
                            onSelect={handleRangeSelect}
                            numberOfMonths={2}
                            locale={es}
                            className="pointer-events-auto"
                            classNames={{
                              months: "flex flex-row gap-1",
                              month: "space-y-0.5",
                              caption: "flex justify-center pt-0 relative items-center h-5",
                              caption_label: "text-[9px] font-medium",
                              nav: "space-x-1 flex items-center",
                              nav_button: "h-4 w-4 bg-transparent p-0 opacity-50 hover:opacity-100 inline-flex items-center justify-center rounded-md border border-input touch-manipulation",
                              nav_button_previous: "absolute left-0",
                              nav_button_next: "absolute right-0",
                              table: "w-full border-collapse",
                              head_row: "flex",
                              head_cell: "text-muted-foreground rounded-md w-5 font-normal text-[8px]",
                              row: "flex w-full mt-0",
                              cell: "h-5 w-5 text-center text-[9px] p-0 relative [&:has([aria-selected].day-range-end)]:rounded-r-md [&:has([aria-selected].day-outside)]:bg-accent/50 [&:has([aria-selected])]:bg-accent first:[&:has([aria-selected])]:rounded-l-md last:[&:has([aria-selected])]:rounded-r-md focus-within:relative focus-within:z-20",
                              day: "h-5 w-5 p-0 font-normal text-[9px] aria-selected:opacity-100 inline-flex items-center justify-center rounded-md touch-manipulation",
                              day_range_end: "day-range-end",
                              day_selected: "bg-primary text-primary-foreground",
                              day_today: "bg-accent text-accent-foreground",
                              day_outside: "day-outside text-muted-foreground opacity-50",
                              day_disabled: "text-muted-foreground opacity-50",
                              day_range_middle: "aria-selected:bg-accent aria-selected:text-accent-foreground",
                              day_hidden: "invisible",
                            }}
                          />
                        </div>
                      </div>
                    ) : (
                      /* Layout Portrait: Presets horizontales + 1 calendario */
                      <div className="flex flex-col">
                        <div className="flex gap-1.5 p-2 border-b border-border overflow-x-auto flex-shrink-0">
                          <Button 
                            size="sm" 
                            variant="outline" 
                            className="h-8 px-2 text-xs whitespace-nowrap touch-manipulation"
                            onClick={() => applyPreset("thisWeek")}
                          >
                            Esta semana
                          </Button>
                          <Button 
                            size="sm" 
                            variant="outline" 
                            className="h-8 px-2 text-xs whitespace-nowrap touch-manipulation"
                            onClick={() => applyPreset("thisMonth")}
                          >
                            Este mes
                          </Button>
                          <Button 
                            size="sm" 
                            variant="outline" 
                            className="h-8 px-2 text-xs whitespace-nowrap touch-manipulation"
                            onClick={() => applyPreset("thisQuarter")}
                          >
                            Este trimestre
                          </Button>
                        </div>
                        <div className="p-2 flex justify-center">
                          <Calendar
                            mode="range"
                            selected={tempRange}
                            onSelect={handleRangeSelect}
                            numberOfMonths={1}
                            locale={es}
                            className="pointer-events-auto"
                            classNames={{
                              months: "flex flex-col",
                              month: "space-y-2",
                              caption: "flex justify-center pt-1 relative items-center",
                              caption_label: "text-sm font-medium",
                              nav: "space-x-1 flex items-center",
                              nav_button: "h-8 w-8 bg-transparent p-0 opacity-50 hover:opacity-100 inline-flex items-center justify-center rounded-md border border-input touch-manipulation",
                              nav_button_previous: "absolute left-1",
                              nav_button_next: "absolute right-1",
                              table: "w-full border-collapse",
                              head_row: "flex",
                              head_cell: "text-muted-foreground rounded-md w-10 font-normal text-[0.7rem]",
                              row: "flex w-full mt-1",
                              cell: "h-10 w-10 text-center text-sm p-0 relative [&:has([aria-selected].day-range-end)]:rounded-r-md [&:has([aria-selected].day-outside)]:bg-accent/50 [&:has([aria-selected])]:bg-accent first:[&:has([aria-selected])]:rounded-l-md last:[&:has([aria-selected])]:rounded-r-md focus-within:relative focus-within:z-20",
                              day: "h-10 w-10 p-0 font-normal aria-selected:opacity-100 inline-flex items-center justify-center rounded-md touch-manipulation",
                              day_range_end: "day-range-end",
                              day_selected: "bg-primary text-primary-foreground",
                              day_today: "bg-accent text-accent-foreground",
                              day_outside: "day-outside text-muted-foreground opacity-50",
                              day_disabled: "text-muted-foreground opacity-50",
                              day_range_middle: "aria-selected:bg-accent aria-selected:text-accent-foreground",
                              day_hidden: "invisible",
                            }}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                  
                  {/* Footer fijo con botón Aplicar */}
                  <div className="p-3 border-t border-border bg-popover flex-shrink-0">
                    <Button 
                      className="w-full h-11 text-sm touch-manipulation" 
                      onClick={applyRange} 
                      disabled={!tempRange?.from || !tempRange?.to}
                    >
                      Aplicar
                    </Button>
                  </div>
                </DialogPrimitive.Content>
              </div>
            </DialogPrimitive.Portal>
          </DialogPrimitive.Root>
        </>
      ) : (
        /* Desktop: Popover normal */
        <Popover open={rangePickerOpen} onOpenChange={setRangePickerOpen}>
          <PopoverTrigger asChild>
            <Button
              variant={viewMode === "custom" ? "default" : "outline"}
              size="sm"
              className={cn(
                "h-10 sm:h-7 px-3 text-xs gap-1.5 touch-manipulation min-w-[44px]",
                viewMode === "custom" && "bg-primary text-primary-foreground"
              )}
              onClick={() => {
                handleViewModeChange("custom");
                setRangePickerOpen(true);
              }}
            >
              <CalendarRange className="h-4 w-4 sm:h-3.5 sm:w-3.5" />
              <span className="hidden sm:inline">Rango</span>
            </Button>
          </PopoverTrigger>
          <PopoverContent 
            className="p-0 bg-popover border border-border shadow-lg z-[100] w-auto"
            align="start"
            sideOffset={8}
            collisionPadding={{ top: 20, bottom: 20, left: 16, right: 16 }}
          >
            <div className="flex flex-col">
              {/* Header con rango seleccionado y botón Aplicar */}
              <div className="flex flex-shrink-0 items-center justify-between p-2 border-b border-border bg-muted/50">
                <div className="text-xs text-muted-foreground">
                  {tempRange?.from && tempRange?.to ? (
                    <span className="font-medium text-foreground">
                      {format(tempRange.from, "d MMM yyyy", { locale: es })} - {format(tempRange.to, "d MMM yyyy", { locale: es })}
                    </span>
                  ) : (
                    <span>Selecciona un rango de fechas</span>
                  )}
                </div>
                <Button size="sm" className="h-6 text-xs ml-4 px-3" onClick={applyRange} disabled={!tempRange?.from || !tempRange?.to}>
                  Aplicar
                </Button>
              </div>
              
              {/* Contenido con presets y calendario */}
              <div className="flex">
                {/* Presets */}
                <div className="border-r border-border p-2 space-y-0.5 min-w-[130px]">
                  <p className="text-xs font-semibold text-muted-foreground mb-1.5">Presets</p>
                  <Button variant="ghost" size="sm" className="w-full justify-start text-xs h-6" onClick={() => applyPreset("thisWeek")}>
                    Esta semana
                  </Button>
                  <Button variant="ghost" size="sm" className="w-full justify-start text-xs h-6" onClick={() => applyPreset("thisMonth")}>
                    Este mes
                  </Button>
                  <Button variant="ghost" size="sm" className="w-full justify-start text-xs h-6" onClick={() => applyPreset("thisQuarter")}>
                    Este trimestre
                  </Button>
                </div>
                {/* Calendar - Compacto para web */}
                <div className="p-2">
                  <Calendar
                    mode="range"
                    selected={tempRange}
                    onSelect={handleRangeSelect}
                    numberOfMonths={2}
                    locale={es}
                    className="pointer-events-auto"
                    classNames={{
                      months: "flex flex-row gap-3",
                      month: "space-y-1",
                      caption: "flex justify-center pt-0.5 relative items-center",
                      caption_label: "text-xs font-medium",
                      nav: "space-x-1 flex items-center",
                      nav_button: "h-6 w-6 bg-transparent p-0 opacity-50 hover:opacity-100 inline-flex items-center justify-center rounded-md border border-input hover:bg-accent hover:text-accent-foreground",
                      nav_button_previous: "absolute left-0.5",
                      nav_button_next: "absolute right-0.5",
                      table: "w-full border-collapse",
                      head_row: "flex",
                      head_cell: "text-muted-foreground rounded-md w-7 font-normal text-[0.65rem]",
                      row: "flex w-full mt-0.5",
                      cell: "h-7 w-7 text-center text-xs p-0 relative [&:has([aria-selected].day-range-end)]:rounded-r-md [&:has([aria-selected].day-outside)]:bg-accent/50 [&:has([aria-selected])]:bg-accent first:[&:has([aria-selected])]:rounded-l-md last:[&:has([aria-selected])]:rounded-r-md focus-within:relative focus-within:z-20",
                      day: "h-7 w-7 p-0 font-normal text-xs aria-selected:opacity-100 inline-flex items-center justify-center rounded-md hover:bg-accent hover:text-accent-foreground",
                      day_range_end: "day-range-end",
                      day_selected: "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground focus:bg-primary focus:text-primary-foreground",
                      day_today: "bg-accent text-accent-foreground",
                      day_outside: "day-outside text-muted-foreground opacity-50 aria-selected:bg-accent/50 aria-selected:text-muted-foreground aria-selected:opacity-30",
                      day_disabled: "text-muted-foreground opacity-50",
                      day_range_middle: "aria-selected:bg-accent aria-selected:text-accent-foreground",
                      day_hidden: "invisible",
                    }}
                  />
                </div>
              </div>
            </div>
          </PopoverContent>
        </Popover>
      )}

      {/* Navigation */}
      <div className="flex items-center gap-1 flex-shrink-0">
        <Button variant="outline" size="icon" className="h-10 w-10 sm:h-7 sm:w-7 touch-manipulation" onClick={navigatePrevious}>
          <ChevronLeft className="h-5 w-5 sm:h-4 sm:w-4" />
        </Button>
        <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="h-10 sm:h-7 px-2 sm:px-3 min-w-[120px] sm:min-w-[200px] justify-start text-xs touch-manipulation">
              <CalendarIcon className="h-4 w-4 sm:h-3 sm:w-3 mr-1 sm:mr-2 flex-shrink-0" />
              <span className="capitalize truncate text-[11px] sm:text-xs">{getDateRangeLabel()}</span>
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
        <Button variant="outline" size="icon" className="h-10 w-10 sm:h-7 sm:w-7 touch-manipulation" onClick={navigateNext}>
          <ChevronRight className="h-5 w-5 sm:h-4 sm:w-4" />
        </Button>
        <Button variant="ghost" size="sm" className="h-10 sm:h-7 px-3 sm:px-2 text-xs touch-manipulation min-w-[44px]" onClick={goToToday}>
          Hoy
        </Button>
      </div>

      {/* Status Filter */}
      <Select value={statusFilter} onValueChange={(v) => onStatusChange(v as ProjectStatus | "todos")}>
        <SelectTrigger className="w-full sm:w-[160px] h-10 sm:h-7 text-xs bg-background touch-manipulation flex-shrink-0 min-w-[120px]">
          <SelectValue placeholder="Estado" />
        </SelectTrigger>
        <SelectContent className="bg-popover border border-border shadow-lg z-50">
          {STATUS_OPTIONS.map((option) => (
            <SelectItem key={option.value} value={option.value} className="touch-manipulation min-h-[44px] sm:min-h-0">
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