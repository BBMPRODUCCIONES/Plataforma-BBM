import { useMemo, useState } from "react";
import { Project } from "@/types";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { listaDeProductores } from "@/components/ProductorSelect";

/**
 * La lista detras del aviso rojo "N eventos sin costos".
 *
 * El aviso decia cuantos faltaban pero no cuales, y para encontrarlos habia
 * que recorrer la tabla mes por mes. Aqui salen todos, del mas viejo al mas
 * nuevo (el mas viejo es el que mas se olvida), con un boton que abre de una
 * vez la ventana de costos de ese evento.
 */
interface ListaSinCostosProps {
  eventos: Project[];
  /** Eventos donde quien mira es el productor: se marcan. */
  esMio: (p: Project) => boolean;
  onAbrirCostos: (id: string) => void;
}

// Mismo criterio que el contador del aviso, para que los numeros cuadren.
const sinProductor = (p: Project) => listaDeProductores(p.productor).length === 0;

const fechaCorta = (v?: string) => {
  if (!v) return "Sin fecha";
  const d = new Date(v.length > 10 ? v : `${v}T00:00:00`);
  if (isNaN(d.getTime())) return v;
  return d.toLocaleDateString("es-CO", { day: "numeric", month: "short" });
};

export function ListaSinCostos({ eventos, esMio, onAbrirCostos }: ListaSinCostosProps) {
  const [filtro, setFiltro] = useState<"todos" | "sin_productor">("todos");

  const ordenados = useMemo(
    () =>
      [...eventos].sort((a, b) =>
        (a.fechaEjecucionInicio || "").localeCompare(b.fechaEjecucionInicio || "")
      ),
    [eventos]
  );
  const nSinProductor = ordenados.filter(sinProductor).length;
  const visibles = filtro === "sin_productor" ? ordenados.filter(sinProductor) : ordenados;

  return (
    <div className="flex flex-col gap-2">
      <div>
        <p className="text-sm font-semibold">Eventos ejecutados sin costos</p>
        <p className="text-xs text-muted-foreground">
          Del más antiguo al más reciente. "Costos" abre la ventana para cargarlos.
        </p>
      </div>

      {nSinProductor > 0 && (
        <div className="flex gap-1">
          <Button
            size="sm"
            variant={filtro === "todos" ? "secondary" : "ghost"}
            className="h-7 text-xs"
            onClick={() => setFiltro("todos")}
          >
            Todos ({ordenados.length})
          </Button>
          <Button
            size="sm"
            variant={filtro === "sin_productor" ? "secondary" : "ghost"}
            className="h-7 text-xs"
            onClick={() => setFiltro("sin_productor")}
          >
            Sin productor ({nSinProductor})
          </Button>
        </div>
      )}

      <ul className="max-h-[60vh] overflow-y-auto divide-y divide-border -mx-1">
        {visibles.map((p) => {
          const mio = esMio(p);
          return (
            <li key={p.id} className="flex items-center gap-2 px-1 py-2">
              <span className="w-14 shrink-0 text-xs tabular-nums text-muted-foreground">
                {fechaCorta(p.fechaEjecucionInicio)}
              </span>
              <span className="min-w-0 flex-1">
                <span className={cn("block truncate text-sm font-medium", mio && "text-destructive")}>
                  {p.evento || "Sin nombre"}
                </span>
                <span className="block truncate text-xs text-muted-foreground">
                  {p.cliente || "Sin cliente"} ·{" "}
                  {sinProductor(p) ? (
                    <span className="font-medium text-amber-500">Sin productor</span>
                  ) : (
                    p.productor
                  )}
                </span>
              </span>
              <Button
                size="sm"
                variant="outline"
                className="h-7 shrink-0 px-2 text-xs"
                onClick={() => onAbrirCostos(p.id)}
              >
                Costos
              </Button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export default ListaSinCostos;
