import { useNavigate } from "react-router-dom";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { ArrowUpRight, CalendarDays, Clock, MapPin, User } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/StatusBadge";
import { Project } from "@/types";
import { colorVisualDeEvento, fondoDeColor } from "@/lib/coloresProyecto";
import { ListaAdjuntos } from "@/components/ListaAdjuntos";
import { ComentariosEvento } from "@/components/ComentariosEvento";

interface DetalleEventoDialogProps {
  proyecto: Project | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /**
   * Si es false se ocultan los montos. El detalle se abre desde el calendario,
   * que ven todos los roles; el dinero no.
   */
  mostrarDinero?: boolean;
  /**
   * Que hace el boton de salida. Si el panel sabe llevar a su propia tabla
   * (el calendario vive dentro de una pestana), se usa eso; si no, se navega
   * a Operaciones, que es donde esta la ficha completa del evento.
   */
  onVerEnTabla?: () => void;
}

const pesos = new Intl.NumberFormat("es-CO", {
  style: "currency",
  currency: "COP",
  maximumFractionDigits: 0,
});

/** "2026-09-15" -> "15 sep 2026". Vacio o invalido -> null. */
function fecha(valor?: string | null): string | null {
  if (!valor) return null;
  try {
    const d = parseISO(valor.length > 10 ? valor : `${valor}T00:00:00`);
    return isNaN(d.getTime()) ? null : format(d, "d MMM yyyy", { locale: es });
  } catch {
    return null;
  }
}

/** Un dia suelto se escribe una sola vez, no "15 sep - 15 sep". */
function rango(desde?: string | null, hasta?: string | null): string | null {
  const a = fecha(desde);
  const b = fecha(hasta);
  if (!a) return null;
  return !b || a === b ? a : `${a} — ${b}`;
}

function horas(desde?: string | null, hasta?: string | null): string | null {
  if (!desde && !hasta) return null;
  if (desde && hasta) return `${desde} a ${hasta}`;
  return desde || hasta || null;
}

function Fase({
  nombre,
  punto,
  dias,
  franja,
}: {
  nombre: string;
  punto: string;
  dias: string | null;
  franja: string | null;
}) {
  if (!dias && !franja) return null;
  return (
    <div className="rounded-lg border border-border/70 p-3">
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        <span className={`h-2 w-2 rounded-full ${punto}`} />
        {nombre}
      </div>
      {dias && (
        <div className="mt-1.5 flex items-center gap-1.5 text-sm">
          <CalendarDays className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          {dias}
        </div>
      )}
      {franja && (
        <div className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
          <Clock className="h-3.5 w-3.5 shrink-0" />
          {franja}
        </div>
      )}
    </div>
  );
}

function Dato({ etiqueta, valor }: { etiqueta: string; valor?: string | null }) {
  if (!valor) return null;
  return (
    <div className="min-w-0">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{etiqueta}</div>
      <div className="mt-0.5 break-words text-sm">{valor}</div>
    </div>
  );
}

/**
 * Ficha de un evento. Se abre al tocarlo en el calendario, donde antes solo se
 * saltaba a la tabla: en celular eso dejaba al usuario frente a la misma
 * cuadricula, sin haber respondido lo que iba a mirar (a que hora es, donde es,
 * quien responde).
 */
export function DetalleEventoDialog({
  proyecto,
  open,
  onOpenChange,
  mostrarDinero = false,
  onVerEnTabla,
}: DetalleEventoDialogProps) {
  const navigate = useNavigate();
  if (!proyecto) return null;

  const marca = colorVisualDeEvento(proyecto);
  const responsable =
    proyecto.administrativoResponsable ||
    proyecto.productor ||
    proyecto.jefeOperaciones ||
    proyecto.aCargoDe ||
    null;

  const verEnLaTabla = () => {
    onOpenChange(false);
    const params = new URLSearchParams({
      eventId: proyecto.id,
      eventName: proyecto.evento || "",
      source: "calendario",
    });
    navigate(`/panel-operaciones?${params.toString()}`);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg sm:max-h-[85vh] sm:overflow-y-auto">
        <DialogHeader className="pr-10">
          <DialogTitle className="text-left text-base leading-snug">
            {proyecto.evento || "Sin nombre"}
          </DialogTitle>
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <StatusBadge status={proyecto.estado} />
            {marca && (
              /* El nombre va en tinta normal y el color lo lleva el punto. El
                 amarillo de Bayron como color de letra no se lee sobre claro,
                 y aqui hace falta que se lea, no que combine. */
              <span
                style={{
                  borderColor: marca.color,
                  backgroundColor: fondoDeColor(marca.color, 0.14),
                }}
                className="flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold text-foreground"
              >
                <span
                  className="h-1.5 w-1.5 rounded-full"
                  style={{ backgroundColor: marca.color }}
                />
                {marca.nombre}
              </span>
            )}
            {proyecto.isDeleted && (
              <span className="rounded-full border border-destructive px-2 py-0.5 text-[10px] font-semibold text-destructive">
                Eliminado
              </span>
            )}
          </div>
        </DialogHeader>

        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Dato etiqueta="Cliente" valor={proyecto.cliente} />
            <Dato etiqueta="Centro de costos" valor={proyecto.centroCostos} />
          </div>

          {proyecto.ubicacion && (
            <div className="flex items-start gap-1.5 text-sm">
              <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              <span className="break-words">{proyecto.ubicacion}</span>
            </div>
          )}

          {responsable && (
            <div className="flex items-center gap-1.5 text-sm">
              <User className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              <span className="break-words">{responsable}</span>
            </div>
          )}

          <div className="grid gap-2 sm:grid-cols-3">
            <Fase
              nombre="Montaje"
              punto="bg-blue-500"
              dias={rango(proyecto.fechaMontajeInicio, proyecto.fechaMontajeFin)}
              franja={horas(proyecto.horaMontajeInicio, proyecto.horaMontajeFin)}
            />
            <Fase
              nombre="Ejecución"
              punto="bg-emerald-500"
              dias={rango(proyecto.fechaEjecucionInicio, proyecto.fechaEjecucionFin)}
              franja={horas(proyecto.horaEjecucionInicio, proyecto.horaEjecucionFin)}
            />
            <Fase
              nombre="Desmontaje"
              punto="bg-amber-500"
              dias={rango(proyecto.fechaDesmontajeInicio, proyecto.fechaDesmontajeFin)}
              franja={horas(proyecto.horaDesmontajeInicio, proyecto.horaDesmontajeFin)}
            />
          </div>

          {/* Boolean() no sobra: con los dos ingresos en cero, la expresion
              valia 0 y React pinta el 0 como texto. Salia un cero suelto entre
              las fechas y las notas. */}
          {mostrarDinero && Boolean(proyecto.ingresoTotal || proyecto.ingresoBruto) && (
            <div className="grid grid-cols-2 gap-3 rounded-lg border border-border/70 p-3">
              <Dato
                etiqueta="Ingreso total"
                valor={proyecto.ingresoTotal ? pesos.format(Number(proyecto.ingresoTotal)) : null}
              />
              <Dato
                etiqueta="Ingreso bruto"
                valor={proyecto.ingresoBruto ? pesos.format(Number(proyecto.ingresoBruto)) : null}
              />
            </div>
          )}

          {proyecto.numFactura && <Dato etiqueta="# Factura" valor={proyecto.numFactura} />}

          {/* Los archivos del evento, para abrirlos sin salir de la ficha. */}
          <ListaAdjuntos adjuntos={proyecto.cotizaciones || []} etiqueta="Cotización" />
          <ListaAdjuntos adjuntos={proyecto.ordenesCompra || []} etiqueta="Orden de compra" />

          {proyecto.notas && (
            <div>
              <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Notas</div>
              <p className="mt-0.5 whitespace-pre-wrap break-words text-sm text-foreground/80">
                {proyecto.notas}
              </p>
            </div>
          )}

          {/* Los comentarios van de ultimos, debajo de los datos del evento:
              primero se lee de que evento se trata y luego lo que el equipo
              dijo de el. Los escribe cualquiera, sin importar el rol. */}
          <div className="border-t border-border pt-3">
            <ComentariosEvento proyectoId={proyecto.id} activo={open} />
          </div>

          <Button
            variant="outline"
            className="h-11 w-full"
            onClick={onVerEnTabla ? () => { onOpenChange(false); onVerEnTabla(); } : verEnLaTabla}
          >
            <ArrowUpRight className="mr-2 h-4 w-4" />
            {onVerEnTabla ? "Ver en la tabla" : "Abrir en Operaciones"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default DetalleEventoDialog;
