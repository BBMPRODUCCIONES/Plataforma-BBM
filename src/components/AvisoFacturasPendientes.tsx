import { useMemo, useState } from "react";
import { Receipt } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useAuth } from "@/contexts/AuthContext";
import { useProjects } from "@/contexts/ProjectsContext";
import { FacturaDialog } from "@/components/FacturaEvento";
import { Button } from "@/components/ui/button";
import { esResponsableFacturas, faltaFactura, FACTURA_OBLIGATORIA_DESDE } from "@/lib/permisosFactura";
import { cn } from "@/lib/utils";

/**
 * Aviso de facturas pendientes, en la barra superior de todas las pantallas.
 *
 * Solo lo ve el responsable de facturas (administrativo@). Los demas que
 * pueden subir facturas no lo reciben, a proposito: si le llega a todos,
 * nadie se siente responsable. Sale de la lista cuando se sube la factura o
 * se marca "No se factura".
 */
const fechaCorta = (v?: string) => {
  if (!v) return "Sin fecha";
  const d = new Date(`${v.slice(0, 10)}T00:00:00`);
  return isNaN(d.getTime()) ? v : d.toLocaleDateString("es-CO", { day: "numeric", month: "short" });
};

export function AvisoFacturasPendientes({ compacto = false }: { compacto?: boolean }) {
  const { user } = useAuth();
  const { projects, updateProjectMultiple } = useProjects();
  const [abierto, setAbierto] = useState(false);
  // La ventana de la factura va fuera del popover: si viviera adentro, al
  // tocarla el popover se cerraria y se la llevaria con el.
  const [elegidoId, setElegidoId] = useState<string | null>(null);
  const responsable = esResponsableFacturas(user?.email);

  const pendientes = useMemo(
    () =>
      responsable
        ? projects
            .filter(faltaFactura)
            .sort((a, b) =>
              (a.fechaEjecucionFin || a.fechaEjecucionInicio || "").localeCompare(
                b.fechaEjecucionFin || b.fechaEjecucionInicio || ""
              )
            )
        : [],
    [projects, responsable]
  );

  const elegido = elegidoId ? projects.find((p) => p.id === elegidoId) : undefined;
  if (!responsable || (pendientes.length === 0 && !elegido)) return null;

  return (
    <>
    <Popover open={abierto} onOpenChange={setAbierto}>
      <PopoverTrigger asChild>
        <button
          type="button"
          title="Eventos ejecutados sin factura subida"
          className={cn(
            "inline-flex shrink-0 items-center gap-1.5 rounded-md bg-destructive/10 px-2 py-1 text-xs font-medium text-destructive ring-1 ring-inset ring-destructive/40 transition-colors hover:bg-destructive/20"
          )}
        >
          <Receipt className="h-3.5 w-3.5 animate-pulse" />
          {pendientes.length}
          {!compacto && (pendientes.length === 1 ? " factura pendiente" : " facturas pendientes")}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[min(92vw,26rem)] p-3">
        <p className="text-sm font-semibold">Facturas pendientes por subir</p>
        <p className="mb-2 text-xs text-muted-foreground">
          Eventos ya ejecutados (desde el {fechaCorta(FACTURA_OBLIGATORIA_DESDE)}) sin factura. Toca
          "Subir" para cargarla, o márcalo como "No se factura" desde la misma ventana.
        </p>
        <ul className="-mx-1 max-h-[60vh] divide-y divide-border overflow-y-auto">
          {pendientes.map((p) => (
            <li key={p.id} className="flex items-center gap-2 px-1 py-2">
              <span className="w-14 shrink-0 text-xs tabular-nums text-muted-foreground">
                {fechaCorta(p.fechaEjecucionFin || p.fechaEjecucionInicio)}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm">{p.evento || "Sin nombre"}</span>
                <span className="block truncate text-xs text-muted-foreground">{p.cliente || "—"}</span>
              </span>
              <Button
                size="sm"
                variant="outline"
                className="h-7 shrink-0 text-xs"
                onClick={() => {
                  setAbierto(false);
                  setElegidoId(p.id);
                }}
              >
                Subir
              </Button>
            </li>
          ))}
        </ul>
      </PopoverContent>
    </Popover>
    {elegido && (
      <FacturaDialog
        proyecto={elegido}
        onGuardar={(c) => updateProjectMultiple(elegido.id, c)}
        onClose={() => setElegidoId(null)}
      />
    )}
    </>
  );
}
