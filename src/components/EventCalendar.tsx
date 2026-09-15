import { useMemo, useState, useEffect } from "react";
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  isToday,
  isWeekend,
  parseISO,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import { es } from "date-fns/locale";
import { ChevronLeft, ChevronRight, CalendarDays } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";
import { Project } from "@/types";
import { colorVisualDeEvento, COLORES_PROYECTO, fondoDeColor } from "@/lib/coloresProyecto";
import { DetalleEventoDialog } from "@/components/DetalleEventoDialog";

interface EventCalendarProps {
  projects: Project[];
  /** Mes que se muestra al abrir. Por defecto, el mes actual. */
  startDate?: Date;
  /**
   * Que hacer al pedir "ver en la tabla" desde la ficha del evento. Tocar el
   * evento ya no salta directo a la tabla: primero abre la ficha, que es lo
   * que la gente va a mirar (hora, lugar, responsable). El salto queda como
   * un boton dentro de la ficha.
   */
  onProjectClick?: (projectId: string) => void;
  /** Muestra los montos en la ficha. Solo para los paneles que ya los ensenan. */
  mostrarDinero?: boolean;
}

type Fase = "montaje" | "ejecucion" | "desmontaje";

const FASE_ESTILO: Record<Fase, { chip: string; punto: string; nombre: string }> = {
  montaje: {
    chip: "bg-slate-500/15 text-slate-700 dark:text-slate-300 border-slate-500/30",
    punto: "bg-slate-400",
    nombre: "Montaje",
  },
  ejecucion: {
    chip: "bg-sky-500/15 text-sky-700 dark:text-sky-300 border-sky-500/30",
    punto: "bg-sky-500",
    nombre: "Ejecución",
  },
  desmontaje: {
    chip: "bg-fuchsia-500/15 text-fuchsia-700 dark:text-fuchsia-300 border-fuchsia-500/30",
    punto: "bg-fuchsia-500",
    nombre: "Desmontaje",
  },
};

/** Convierte "2026-09-16" (o una fecha con hora) a Date local, sin sorpresas de zona horaria. */
function aFecha(valor?: string | null): Date | null {
  if (!valor) return null;
  try {
    const limpio = valor.length > 10 ? valor : `${valor}T00:00:00`;
    const d = parseISO(limpio);
    return isNaN(d.getTime()) ? null : d;
  } catch {
    return null;
  }
}

function dentroDe(dia: Date, inicio?: string | null, fin?: string | null): boolean {
  const desde = aFecha(inicio);
  if (!desde) return false;
  const hasta = aFecha(fin) ?? desde;
  const d = dia.setHours(0, 0, 0, 0);
  return d >= desde.setHours(0, 0, 0, 0) && d <= hasta.setHours(0, 0, 0, 0);
}

/** Que fase del evento cae en ese dia. La ejecucion manda sobre el resto. */
function faseDelDia(proyecto: Project, dia: Date): Fase | null {
  const d = new Date(dia);
  if (dentroDe(new Date(d), proyecto.fechaEjecucionInicio, proyecto.fechaEjecucionFin)) return "ejecucion";
  if (dentroDe(new Date(d), proyecto.fechaMontajeInicio, proyecto.fechaMontajeFin)) return "montaje";
  if (dentroDe(new Date(d), proyecto.fechaDesmontajeInicio, proyecto.fechaDesmontajeFin)) return "desmontaje";
  return null;
}

export function EventCalendar({
  projects,
  startDate,
  onProjectClick,
  mostrarDinero = false,
}: EventCalendarProps) {
  const [detalleId, setDetalleId] = useState<string | null>(null);
  const proyectoDelDetalle = detalleId
    ? projects.find((p) => p.id === detalleId) ?? null
    : null;
  const isMobile = useIsMobile();
  const [mes, setMes] = useState<Date>(() => startOfMonth(startDate ?? new Date()));
  const [diaAbierto, setDiaAbierto] = useState<Date | null>(null);
  /**
   * Dias cuyo "+N mas" se pulso para ver la lista completa dentro de la casilla.
   * Antes ese texto no hacia nada: decia que faltaban eventos y no habia forma
   * de verlos sin abrir el detalle de abajo.
   */
  const [diasDesplegados, setDiasDesplegados] = useState<Set<string>>(new Set());

  const alternarDesplegado = (clave: string) =>
    setDiasDesplegados((prev) => {
      const siguiente = new Set(prev);
      if (siguiente.has(clave)) siguiente.delete(clave);
      else siguiente.add(clave);
      return siguiente;
    });

  useEffect(() => {
    if (startDate) setMes(startOfMonth(startDate));
  }, [startDate]);

  // La cuadricula arranca en lunes y cubre semanas completas.
  const dias = useMemo(() => {
    const desde = startOfWeek(startOfMonth(mes), { weekStartsOn: 1 });
    const hasta = endOfWeek(endOfMonth(mes), { weekStartsOn: 1 });
    return eachDayOfInterval({ start: desde, end: hasta });
  }, [mes]);

  const eventosPorDia = useMemo(() => {
    const mapa = new Map<string, { proyecto: Project; fase: Fase }[]>();
    dias.forEach((dia) => {
      const clave = format(dia, "yyyy-MM-dd");
      const delDia = projects
        .map((proyecto) => {
          const fase = faseDelDia(proyecto, dia);
          return fase ? { proyecto, fase } : null;
        })
        .filter((x): x is { proyecto: Project; fase: Fase } => x !== null);
      if (delDia.length) mapa.set(clave, delDia);
    });
    return mapa;
  }, [dias, projects]);

  const nombresDias = ["L", "M", "Mi", "J", "V", "S", "D"];
  const maxChips = isMobile ? 0 : 3;

  const irA = (delta: number) => {
    setMes((actual) => addMonths(actual, delta));
    setDiaAbierto(null);
    setDiasDesplegados(new Set());
  };

  const listaDelDia = diaAbierto ? eventosPorDia.get(format(diaAbierto, "yyyy-MM-dd")) ?? [] : [];

  return (
    <div className="flex flex-col gap-3">
      {/* Barra de mes */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="icon"
            className="h-9 w-9"
            aria-label="Mes anterior"
            onClick={() => irA(-1)}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <h3 className="min-w-[10rem] px-1 text-center text-base font-semibold capitalize">
            {format(mes, "MMMM yyyy", { locale: es })}
          </h3>
          <Button
            variant="outline"
            size="icon"
            className="h-9 w-9"
            aria-label="Mes siguiente"
            onClick={() => irA(1)}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex items-center gap-3">
          <div className="hidden flex-wrap items-center gap-3 sm:flex">
            {(Object.keys(FASE_ESTILO) as Fase[]).map((fase) => (
              <span key={fase} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <span className={cn("h-2.5 w-2.5 rounded-full", FASE_ESTILO[fase].punto)} />
                {FASE_ESTILO[fase].nombre}
              </span>
            ))}
            <span className="text-border">|</span>
            {COLORES_PROYECTO.map((c) => (
              <span key={c.valor} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: c.valor }} />
                {c.nombre}
              </span>
            ))}
          </div>
          <Button
            variant="outline"
            size="sm"
            className="h-9"
            onClick={() => {
              setMes(startOfMonth(new Date()));
              setDiaAbierto(new Date());
            }}
          >
            <CalendarDays className="mr-1.5 h-4 w-4" />
            Hoy
          </Button>
        </div>
      </div>

      {/* Cuadricula */}
      <div className="overflow-hidden rounded-lg border border-border">
        <div className="grid grid-cols-7 border-b border-border bg-muted/50">
          {nombresDias.map((n) => (
            <div
              key={n}
              className="py-2 text-center text-[11px] font-semibold uppercase tracking-wide text-muted-foreground"
            >
              {n}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7">
          {dias.map((dia) => {
            const clave = format(dia, "yyyy-MM-dd");
            const delDia = eventosPorDia.get(clave) ?? [];
            const esDeOtroMes = !isSameMonth(dia, mes);
            const seleccionado = diaAbierto && isSameDay(dia, diaAbierto);
            const desplegado = diasDesplegados.has(clave);

            return (
              <button
                type="button"
                key={clave}
                onClick={() => setDiaAbierto(seleccionado ? null : dia)}
                className={cn(
                  "flex min-h-[64px] flex-col items-stretch gap-1 border-b border-r border-border/60 p-1.5 text-left transition-colors sm:min-h-[104px]",
                  desplegado && "bg-accent/20",
                  esDeOtroMes && "bg-muted/30",
                  isWeekend(dia) && !esDeOtroMes && "bg-muted/20",
                  seleccionado && "ring-2 ring-inset ring-primary",
                  delDia.length > 0 && "hover:bg-accent/40"
                )}
              >
                <span
                  className={cn(
                    "flex h-6 w-6 items-center justify-center rounded-full text-xs font-medium",
                    esDeOtroMes ? "text-muted-foreground/50" : "text-foreground",
                    isToday(dia) && "bg-primary font-semibold text-primary-foreground"
                  )}
                >
                  {format(dia, "d")}
                </span>

                {/* En celular solo puntos: los nombres no caben. */}
                {maxChips === 0 ? (
                  delDia.length > 0 && (
                    <span className="mt-0.5 flex flex-wrap gap-1">
                      {delDia.slice(0, 4).map(({ proyecto, fase }) => {
                        const marca = colorVisualDeEvento(proyecto);
                        return (
                          <span
                            key={proyecto.id + fase}
                            title={marca ? `${proyecto.evento} · ${marca.nombre}` : proyecto.evento}
                            style={marca ? { backgroundColor: marca.color } : undefined}
                            className={cn(
                              "h-1.5 w-1.5 rounded-full",
                              !marca && FASE_ESTILO[fase].punto
                            )}
                          />
                        );
                      })}
                      {delDia.length > 4 && (
                        <span className="text-[9px] leading-none text-muted-foreground">
                          +{delDia.length - 4}
                        </span>
                      )}
                    </span>
                  )
                ) : (
                  <span className="flex flex-col gap-0.5">
                    {(desplegado ? delDia : delDia.slice(0, maxChips)).map(({ proyecto, fase }) => {
                      const marca = colorVisualDeEvento(proyecto);
                      return (
                        <span
                          key={proyecto.id + fase}
                          onClick={(e) => {
                            e.stopPropagation();
                            setDetalleId(proyecto.id);
                          }}
                          style={
                            marca
                              ? {
                                  // Fondo suave y borde del color, para que el
                                  // nombre del evento se siga leyendo encima.
                                  backgroundColor: fondoDeColor(marca.color, 0.22),
                                  borderColor: marca.color,
                                }
                              : undefined
                          }
                          className={cn(
                            "truncate rounded border px-1 py-0.5 text-[10px] leading-tight",
                            !marca && FASE_ESTILO[fase].chip,
                            "cursor-pointer hover:brightness-110"
                          )}
                          title={
                            marca
                              ? `${proyecto.evento} · ${FASE_ESTILO[fase].nombre} · ${marca.nombre}`
                              : `${proyecto.evento} · ${FASE_ESTILO[fase].nombre}`
                          }
                        >
                          {proyecto.evento || "Sin nombre"}
                        </span>
                      );
                    })}
                    {delDia.length > maxChips && (
                      <span
                        role="button"
                        tabIndex={0}
                        onClick={(e) => {
                          e.stopPropagation();
                          alternarDesplegado(clave);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            e.stopPropagation();
                            alternarDesplegado(clave);
                          }
                        }}
                        className="cursor-pointer rounded px-1 text-left text-[10px] font-medium text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
                        title={desplegado ? "Ver menos" : "Ver todos los eventos de este día"}
                      >
                        {desplegado ? "ver menos" : `+${delDia.length - maxChips} más`}
                      </span>
                    )}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Detalle del dia elegido */}
      {diaAbierto && (
        <div className="rounded-lg border border-border p-3">
          <h4 className="mb-2 text-sm font-semibold capitalize">
            {format(diaAbierto, "EEEE d 'de' MMMM", { locale: es })}
          </h4>
          {listaDelDia.length === 0 ? (
            <p className="text-sm text-muted-foreground">No hay eventos este día.</p>
          ) : (
            <ul className="flex flex-col gap-1.5">
              {listaDelDia.map(({ proyecto, fase }) => {
                const marca = colorVisualDeEvento(proyecto);
                return (
                  <li key={proyecto.id + fase}>
                    <button
                      type="button"
                      onClick={() => setDetalleId(proyecto.id)}
                      className="flex w-full items-center gap-2 rounded-md border border-border/60 px-2.5 py-2 text-left transition-colors hover:bg-accent/40"
                    >
                      <span
                        style={marca ? { backgroundColor: marca.color } : undefined}
                        className={cn(
                          "h-2.5 w-2.5 shrink-0 rounded-full",
                          !marca && FASE_ESTILO[fase].punto
                        )}
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium">
                          {proyecto.evento || "Sin nombre"}
                        </span>
                        <span className="block truncate text-xs text-muted-foreground">
                          {proyecto.cliente || "Sin cliente"} · {FASE_ESTILO[fase].nombre}
                        </span>
                      </span>
                      {marca && (
                        <span
                          style={{
                            backgroundColor: fondoDeColor(marca.color, 0.22),
                            borderColor: marca.color,
                          }}
                          className="shrink-0 rounded border px-1.5 py-0.5 text-[10px] font-medium"
                        >
                          {marca.nombre}
                        </span>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}

      <DetalleEventoDialog
        proyecto={proyectoDelDetalle}
        open={Boolean(proyectoDelDetalle)}
        onOpenChange={(abierto) => { if (!abierto) setDetalleId(null); }}
        mostrarDinero={mostrarDinero}
        onVerEnTabla={
          onProjectClick && detalleId
            ? () => { const id = detalleId; setDetalleId(null); onProjectClick(id); }
            : undefined
        }
      />
    </div>
  );
}

export default EventCalendar;
