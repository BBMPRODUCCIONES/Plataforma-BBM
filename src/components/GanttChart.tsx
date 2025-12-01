import { useMemo, useRef, useState, useEffect, useCallback } from "react";
import { Project, GanttMonth, HOLIDAYS_2024, HOLIDAYS_2025, CalendarViewMode } from "@/types";
import { cn } from "@/lib/utils";
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  startOfDay,
  endOfDay,
  startOfYear,
  endOfYear,
  eachDayOfInterval,
  eachWeekOfInterval,
  eachMonthOfInterval,
  isWeekend,
  isSaturday,
  isSunday,
  isToday,
  differenceInDays,
  parseISO,
  isWithinInterval,
  addMonths,
  addDays,
} from "date-fns";
import { es } from "date-fns/locale";
import { ZoomIn, ZoomOut, MoveHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";

interface GanttChartProps {
  projects: Project[];
  startDate?: Date;
  monthsToShow?: number;
  viewMode?: CalendarViewMode;
  onProjectClick?: (projectId: string) => void;
}

const HOLIDAYS = { ...HOLIDAYS_2024, ...HOLIDAYS_2025 };

// Dynamic column widths based on view mode
const VIEW_MODE_CONFIG = {
  day: { dayWidth: 60, showDayNames: true, showHours: true },
  week: { dayWidth: 40, showDayNames: true, showHours: false },
  month: { dayWidth: 24, showDayNames: false, showHours: false },
  year: { dayWidth: 8, showDayNames: false, showHours: false },
};

export function GanttChart({ 
  projects, 
  startDate = new Date(), 
  monthsToShow = 3,
  viewMode = "month",
  onProjectClick 
}: GanttChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [startX, setStartX] = useState(0);
  const [scrollLeft, setScrollLeft] = useState(0);
  const [zoomLevel, setZoomLevel] = useState(1);

  const config = VIEW_MODE_CONFIG[viewMode];
  const effectiveDayWidth = config.dayWidth * zoomLevel;

  // Calculate date range based on view mode
  const dateRange = useMemo(() => {
    switch (viewMode) {
      case "day":
        return { 
          start: startOfDay(startDate), 
          end: endOfDay(addDays(startDate, 6)) // Show 7 days
        };
      case "week":
        return { 
          start: startOfWeek(startDate, { weekStartsOn: 1 }), 
          end: endOfWeek(addDays(startDate, 27), { weekStartsOn: 1 }) // ~4 weeks
        };
      case "month":
        return { 
          start: startOfMonth(startDate), 
          end: endOfMonth(addMonths(startDate, monthsToShow - 1)) 
        };
      case "year":
        return { 
          start: startOfYear(startDate), 
          end: endOfYear(startDate) 
        };
      default:
        return { 
          start: startOfMonth(startDate), 
          end: endOfMonth(addMonths(startDate, monthsToShow - 1)) 
        };
    }
  }, [startDate, monthsToShow, viewMode]);

  const { months, allDays } = useMemo(() => {
    const allDays = eachDayOfInterval({ start: dateRange.start, end: dateRange.end });
    
    // Group days by month
    const monthsMap = new Map<string, GanttMonth>();
    
    allDays.forEach((date) => {
      const monthKey = format(date, "yyyy-MM");
      const dateStr = format(date, "yyyy-MM-dd");
      
      if (!monthsMap.has(monthKey)) {
        monthsMap.set(monthKey, {
          name: format(date, "MMMM", { locale: es }),
          year: date.getFullYear(),
          days: [],
        });
      }
      
      monthsMap.get(monthKey)!.days.push({
        date,
        dayOfMonth: date.getDate(),
        dayOfWeek: format(date, "EEE", { locale: es }),
        isWeekend: isWeekend(date),
        isHoliday: !!HOLIDAYS[dateStr],
        holidayName: HOLIDAYS[dateStr],
      });
    });

    return { months: Array.from(monthsMap.values()), allDays };
  }, [dateRange]);

  const totalWidth = allDays.length * effectiveDayWidth;

  const getBarPosition = (projectStartDate: string, projectEndDate: string) => {
    const start = parseISO(projectStartDate);
    const end = parseISO(projectEndDate);
    
    const firstDay = allDays[0];
    const lastDay = allDays[allDays.length - 1];
    const totalDays = differenceInDays(lastDay, firstDay) + 1;

    const isVisible = isWithinInterval(start, { start: firstDay, end: lastDay }) ||
                      isWithinInterval(end, { start: firstDay, end: lastDay }) ||
                      (start <= firstDay && end >= lastDay);

    if (!isVisible) return null;

    const startOffset = Math.max(0, differenceInDays(start, firstDay));
    const endOffset = Math.min(totalDays - 1, differenceInDays(end, firstDay));
    const duration = endOffset - startOffset + 1;

    return {
      left: startOffset * effectiveDayWidth,
      width: duration * effectiveDayWidth,
    };
  };

  const getDayClass = (day: Date) => {
    const dateStr = format(day, "yyyy-MM-dd");
    const holiday = !!HOLIDAYS[dateStr];
    
    if (holiday) return "bg-orange-500/20";
    if (isSunday(day)) return "bg-muted/40";
    if (isSaturday(day)) return "bg-muted/25";
    return "";
  };

  const getTodayPosition = () => {
    const today = new Date();
    const firstDay = allDays[0];
    const lastDay = allDays[allDays.length - 1];
    
    if (today < firstDay || today > lastDay) return null;
    
    const offset = differenceInDays(today, firstDay);
    return offset * effectiveDayWidth + effectiveDayWidth / 2;
  };

  // Drag to pan handlers
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (!containerRef.current) return;
    setIsDragging(true);
    setStartX(e.pageX - containerRef.current.offsetLeft);
    setScrollLeft(containerRef.current.scrollLeft);
  }, []);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDragging || !containerRef.current) return;
    e.preventDefault();
    const x = e.pageX - containerRef.current.offsetLeft;
    const walk = (x - startX) * 1.5;
    containerRef.current.scrollLeft = scrollLeft - walk;
  }, [isDragging, startX, scrollLeft]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  // Zoom with wheel
  const handleWheel = useCallback((e: WheelEvent) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      const delta = e.deltaY > 0 ? -0.1 : 0.1;
      setZoomLevel((prev) => Math.max(0.5, Math.min(3, prev + delta)));
    }
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    if (container) {
      container.addEventListener("wheel", handleWheel, { passive: false });
      return () => container.removeEventListener("wheel", handleWheel);
    }
  }, [handleWheel]);

  // Scroll to today on mount
  useEffect(() => {
    if (containerRef.current) {
      const todayPos = getTodayPosition();
      if (todayPos !== null) {
        containerRef.current.scrollLeft = Math.max(0, todayPos - containerRef.current.clientWidth / 2);
      }
    }
  }, [allDays]);

  const todayPosition = getTodayPosition();

  return (
    <div className="panel-card overflow-hidden">
      <div className="panel-header">
        <h3 className="text-sm font-semibold">Gantt Universal</h3>
        <div className="flex items-center gap-4">
          {/* Zoom controls */}
          <div className="flex items-center gap-1 border border-border rounded-md">
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0"
              onClick={() => setZoomLevel((prev) => Math.max(0.5, prev - 0.25))}
            >
              <ZoomOut className="h-3.5 w-3.5" />
            </Button>
            <span className="text-xs text-muted-foreground w-12 text-center">
              {Math.round(zoomLevel * 100)}%
            </span>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0"
              onClick={() => setZoomLevel((prev) => Math.min(3, prev + 0.25))}
            >
              <ZoomIn className="h-3.5 w-3.5" />
            </Button>
          </div>
          
          {/* Legend */}
          <div className="flex items-center gap-4 text-xs">
            <div className="flex items-center gap-2">
              <div className="w-4 h-3 rounded-sm bg-gantt-montaje" />
              <span className="text-muted-foreground">Montaje</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-3 rounded-sm bg-gantt-ejecucion" />
              <span className="text-muted-foreground">Ejecución</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-3 rounded-sm bg-orange-500/30" />
              <span className="text-muted-foreground">Festivo</span>
            </div>
          </div>
          
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <MoveHorizontal className="h-3.5 w-3.5" />
            <span>Arrastrar para navegar</span>
          </div>
        </div>
      </div>
      
      <div 
        ref={containerRef}
        className={cn(
          "overflow-x-auto scrollbar-thin select-none",
          isDragging && "cursor-grabbing"
        )}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        <div style={{ width: 192 + totalWidth, minWidth: "100%" }}>
          {/* Month Headers */}
          <div className="flex border-b border-border sticky top-0 z-20 bg-card">
            <div className="w-48 min-w-48 px-3 py-2 bg-table-header border-r border-border">
              <span className="text-xs font-medium text-muted-foreground">Proyecto</span>
            </div>
            <div className="flex" style={{ width: totalWidth }}>
              {months.map((month) => (
                <div
                  key={`${month.name}-${month.year}`}
                  className="text-center py-2 bg-table-header border-r border-border"
                  style={{ width: month.days.length * effectiveDayWidth }}
                >
                  <span className="text-xs font-semibold capitalize">
                    {month.name} {month.year}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Day Headers */}
          <div className="flex border-b border-border sticky top-[41px] z-20 bg-card">
            <div className="w-48 min-w-48 px-3 py-1 bg-table-header border-r border-border" />
            <div className="flex" style={{ width: totalWidth }}>
              {allDays.map((day, idx) => {
                const dateStr = format(day, "yyyy-MM-dd");
                const isHoliday = !!HOLIDAYS[dateStr];
                const today = isToday(day);
                
                return (
                  <div
                    key={idx}
                    className={cn(
                      "text-center border-r border-border/50 flex flex-col justify-center",
                      getDayClass(day),
                      today && "bg-primary/20 ring-1 ring-primary ring-inset"
                    )}
                    style={{ width: effectiveDayWidth, minWidth: effectiveDayWidth }}
                    title={HOLIDAYS[dateStr] || format(day, "EEEE d MMMM yyyy", { locale: es })}
                  >
                    <div className={cn(
                      "font-medium leading-tight",
                      effectiveDayWidth < 20 ? "text-[8px]" : "text-[10px]",
                      today && "text-primary font-bold"
                    )}>
                      {day.getDate()}
                    </div>
                    {config.showDayNames && effectiveDayWidth >= 30 && (
                      <div className={cn(
                        "capitalize leading-tight",
                        effectiveDayWidth < 40 ? "text-[8px]" : "text-[10px]",
                        isHoliday ? "text-orange-400" : "text-muted-foreground"
                      )}>
                        {format(day, "EEE", { locale: es }).charAt(0)}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Project Rows */}
          {projects.length === 0 ? (
            <div className="flex items-center justify-center py-12 text-muted-foreground text-sm">
              No hay proyectos para mostrar en este rango de fechas
            </div>
          ) : (
            projects.map((project) => {
              const montajeBar = getBarPosition(project.fechaMontajeInicio, project.fechaMontajeFin);
              const ejecucionBar = getBarPosition(project.fechaEjecucionInicio, project.fechaEjecucionFin);

              return (
                <div 
                  key={project.id} 
                  className={cn(
                    "flex border-b border-border hover:bg-table-row-hover transition-colors",
                    onProjectClick && "cursor-pointer"
                  )}
                  onClick={() => onProjectClick?.(project.id)}
                >
                  <div className="w-48 min-w-48 px-3 py-3 border-r border-border bg-card sticky left-0 z-10">
                    <div className="text-xs font-medium truncate">{project.evento}</div>
                    <div className="text-[10px] text-muted-foreground truncate">{project.cliente}</div>
                  </div>
                  <div className="relative py-2" style={{ width: totalWidth }}>
                    {/* Grid lines */}
                    <div className="absolute inset-0 flex pointer-events-none">
                      {allDays.map((day, idx) => (
                        <div
                          key={idx}
                          className={cn(
                            "border-r border-border/20",
                            getDayClass(day)
                          )}
                          style={{ width: effectiveDayWidth }}
                        />
                      ))}
                    </div>
                    
                    {/* Today line */}
                    {todayPosition !== null && (
                      <div 
                        className="absolute top-0 bottom-0 w-0.5 bg-primary z-10 pointer-events-none"
                        style={{ left: todayPosition }}
                      />
                    )}
                    
                    {/* Bars */}
                    <div className="relative h-12 px-1">
                      {montajeBar && (
                        <div
                          className="absolute top-1 h-4 gantt-bar gantt-bar-montaje rounded-sm shadow-sm"
                          style={{ left: montajeBar.left, width: Math.max(montajeBar.width - 2, 4) }}
                          title={`Montaje: ${format(parseISO(project.fechaMontajeInicio), "d MMM", { locale: es })} - ${format(parseISO(project.fechaMontajeFin), "d MMM", { locale: es })}`}
                        >
                          {montajeBar.width > 60 && (
                            <span className="absolute inset-0 flex items-center justify-center text-[9px] text-white/90 font-medium truncate px-1">
                              Montaje
                            </span>
                          )}
                        </div>
                      )}
                      {ejecucionBar && (
                        <div
                          className="absolute bottom-1 h-4 gantt-bar gantt-bar-ejecucion rounded-sm shadow-sm"
                          style={{ left: ejecucionBar.left, width: Math.max(ejecucionBar.width - 2, 4) }}
                          title={`Ejecución: ${format(parseISO(project.fechaEjecucionInicio), "d MMM", { locale: es })} - ${format(parseISO(project.fechaEjecucionFin), "d MMM", { locale: es })}`}
                        >
                          {ejecucionBar.width > 60 && (
                            <span className="absolute inset-0 flex items-center justify-center text-[9px] text-white/90 font-medium truncate px-1">
                              Ejecución
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
      
      {/* Keyboard hint */}
      <div className="px-4 py-2 border-t border-border text-[10px] text-muted-foreground flex items-center gap-4">
        <span>Ctrl/Cmd + Scroll para zoom</span>
        <span>•</span>
        <span>Arrastrar para navegar horizontalmente</span>
      </div>
    </div>
  );
}