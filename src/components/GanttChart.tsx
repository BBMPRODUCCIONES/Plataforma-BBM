import { useMemo } from "react";
import { Project, GanttMonth, HOLIDAYS_2024, HOLIDAYS_2025 } from "@/types";
import { cn } from "@/lib/utils";
import {
  format,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  isWeekend,
  isSaturday,
  isSunday,
  differenceInDays,
  parseISO,
  isWithinInterval,
  addMonths,
} from "date-fns";
import { es } from "date-fns/locale";

interface GanttChartProps {
  projects: Project[];
  startDate?: Date;
  monthsToShow?: number;
  onProjectClick?: (projectId: string) => void;
}

const HOLIDAYS = { ...HOLIDAYS_2024, ...HOLIDAYS_2025 };

export function GanttChart({ 
  projects, 
  startDate = new Date(), 
  monthsToShow = 3,
  onProjectClick 
}: GanttChartProps) {
  const { months, allDays } = useMemo(() => {
    const months: GanttMonth[] = [];
    let allDays: Date[] = [];

    for (let i = 0; i < monthsToShow; i++) {
      const currentMonth = addMonths(startOfMonth(startDate), i);
      const monthStart = startOfMonth(currentMonth);
      const monthEnd = endOfMonth(currentMonth);
      const days = eachDayOfInterval({ start: monthStart, end: monthEnd });

      months.push({
        name: format(currentMonth, "MMMM", { locale: es }),
        year: currentMonth.getFullYear(),
        days: days.map((date) => {
          const dateStr = format(date, "yyyy-MM-dd");
          return {
            date,
            dayOfMonth: date.getDate(),
            dayOfWeek: format(date, "EEE", { locale: es }),
            isWeekend: isWeekend(date),
            isHoliday: !!HOLIDAYS[dateStr],
            holidayName: HOLIDAYS[dateStr],
          };
        }),
      });

      allDays = [...allDays, ...days];
    }

    return { months, allDays };
  }, [startDate, monthsToShow]);

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
      left: `${(startOffset / totalDays) * 100}%`,
      width: `${(duration / totalDays) * 100}%`,
    };
  };

  const getDayClass = (day: Date) => {
    const dateStr = format(day, "yyyy-MM-dd");
    const isHoliday = !!HOLIDAYS[dateStr];
    
    if (isHoliday) return "bg-orange-500/20";
    if (isSunday(day)) return "bg-muted/40 border-b-2 border-muted-foreground/30";
    if (isSaturday(day)) return "bg-muted/30 border-b border-muted-foreground/20";
    return "";
  };

  return (
    <div className="panel-card overflow-hidden">
      <div className="panel-header">
        <h3 className="text-sm font-semibold">Gantt Universal</h3>
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
      </div>
      
      <div className="overflow-x-auto scrollbar-thin">
        <div className="min-w-[1200px]">
          {/* Month Headers */}
          <div className="flex border-b border-border">
            <div className="w-48 min-w-48 px-3 py-2 bg-table-header border-r border-border">
              <span className="text-xs font-medium text-muted-foreground">Proyecto</span>
            </div>
            <div className="flex-1 flex">
              {months.map((month) => (
                <div
                  key={`${month.name}-${month.year}`}
                  className="flex-1 text-center py-2 bg-table-header border-r border-border last:border-r-0"
                >
                  <span className="text-xs font-semibold capitalize">
                    {month.name} {month.year}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Day Headers */}
          <div className="flex border-b border-border">
            <div className="w-48 min-w-48 px-3 py-1 bg-table-header border-r border-border" />
            <div className="flex-1 flex">
              {months.map((month) =>
                month.days.map((day) => (
                  <div
                    key={`${month.name}-${day.dayOfMonth}`}
                    className={cn(
                      "flex-1 text-center py-1 text-[10px] border-r border-border/50 last:border-r-0",
                      getDayClass(day.date)
                    )}
                    title={day.holidayName}
                  >
                    <div className="font-medium">{day.dayOfMonth}</div>
                    <div className={cn(
                      "capitalize",
                      day.isHoliday ? "text-orange-400" : "text-muted-foreground"
                    )}>
                      {day.dayOfWeek.charAt(0)}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Project Rows */}
          {projects.map((project) => {
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
                <div className="w-48 min-w-48 px-3 py-3 border-r border-border">
                  <div className="text-xs font-medium truncate">{project.evento}</div>
                  <div className="text-[10px] text-muted-foreground truncate">{project.cliente}</div>
                </div>
                <div className="flex-1 relative py-2 px-1">
                  {/* Grid lines */}
                  <div className="absolute inset-0 flex pointer-events-none">
                    {allDays.map((day, idx) => (
                      <div
                        key={idx}
                        className={cn(
                          "flex-1 border-r border-border/30 last:border-r-0",
                          getDayClass(day)
                        )}
                      />
                    ))}
                  </div>
                  
                  {/* Bars */}
                  <div className="relative h-10">
                    {montajeBar && (
                      <div
                        className="absolute top-0 h-4 gantt-bar gantt-bar-montaje"
                        style={{ left: montajeBar.left, width: montajeBar.width }}
                        title={`Montaje: ${project.fechaMontajeInicio} - ${project.fechaMontajeFin}`}
                      />
                    )}
                    {ejecucionBar && (
                      <div
                        className="absolute bottom-0 h-4 gantt-bar gantt-bar-ejecucion"
                        style={{ left: ejecucionBar.left, width: ejecucionBar.width }}
                        title={`Ejecución: ${project.fechaEjecucionInicio} - ${project.fechaEjecucionFin}`}
                      />
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
