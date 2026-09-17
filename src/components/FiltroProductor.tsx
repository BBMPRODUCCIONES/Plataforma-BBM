import { useMemo, useState } from "react";
import { Check, ChevronsUpDown, UserCog, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { Project } from "@/types";
import { listaDeProductores } from "@/components/ProductorSelect";

/** Valor especial: eventos que no tienen productor asignado. */
export const SIN_PRODUCTOR = "__sin_productor__";

interface FiltroProductorProps {
  /** Los eventos de los que salen los nombres del desplegable. */
  proyectos: Project[];
  value: string;
  onChange: (valor: string) => void;
  compacto?: boolean;
}

/**
 * Decide si un evento pasa el filtro de productor.
 *
 * Un evento puede tener varios productores separados por coma, asi que la
 * comparacion es contra la lista y no contra el texto entero: filtrando por
 * "Diego" tambien salen los eventos donde Diego trabaja con alguien mas.
 */
export function pasaFiltroDeProductor(proyecto: Project, filtro: string): boolean {
  if (!filtro || filtro === "todos") return true;
  const productores = listaDeProductores(proyecto.productor);
  if (filtro === SIN_PRODUCTOR) return productores.length === 0;
  return productores.some((n) => n.toLowerCase() === filtro.toLowerCase());
}

/**
 * Filtra la tabla por productor encargado.
 *
 * Los nombres salen de los eventos que hay, no de la lista de usuarios: si un
 * usuario nunca ha sido productor de nada, ofrecerlo solo sirve para llegar a
 * una tabla vacia. Asi el desplegable siempre lleva a algo.
 */
export function FiltroProductor({
  proyectos,
  value,
  onChange,
  compacto = false,
}: FiltroProductorProps) {
  const [abierto, setAbierto] = useState(false);

  const { nombres, sinProductor } = useMemo(() => {
    const cuenta = new Map<string, { nombre: string; total: number }>();
    let sin = 0;
    for (const p of proyectos) {
      if (p.isDeleted) continue;
      const productores = listaDeProductores(p.productor);
      if (productores.length === 0) {
        sin += 1;
        continue;
      }
      for (const n of productores) {
        const clave = n.toLowerCase();
        const previo = cuenta.get(clave);
        cuenta.set(clave, { nombre: previo?.nombre ?? n, total: (previo?.total ?? 0) + 1 });
      }
    }
    return {
      nombres: [...cuenta.values()].sort((a, b) => a.nombre.localeCompare(b.nombre, "es")),
      sinProductor: sin,
    };
  }, [proyectos]);

  const activo = Boolean(value && value !== "todos");
  const etiqueta =
    value === SIN_PRODUCTOR
      ? "Sin productor"
      : activo
        ? value
        : "Productor";

  const elegir = (v: string) => {
    onChange(v);
    setAbierto(false);
  };

  return (
    <Popover open={abierto} onOpenChange={setAbierto}>
      <PopoverTrigger asChild>
        <Button
          variant={activo ? "default" : "outline"}
          size="sm"
          className={cn(
            "gap-1.5 whitespace-nowrap text-xs",
            compacto ? "h-8 px-2.5" : "h-9",
            activo && "max-w-[180px]"
          )}
          title={activo ? `Filtrando por ${etiqueta}` : "Filtrar por productor"}
        >
          <UserCog className="h-3.5 w-3.5 shrink-0" />
          <span className="truncate">{etiqueta}</span>
          {activo ? (
            // Quitar el filtro sin abrir el menu. Es un span y no un button
            // porque va dentro de otro boton.
            <span
              role="button"
              tabIndex={-1}
              aria-label="Quitar el filtro de productor"
              onClick={(e) => { e.stopPropagation(); onChange("todos"); }}
              className="shrink-0 rounded-sm opacity-70 hover:opacity-100"
            >
              <X className="h-3.5 w-3.5" />
            </span>
          ) : (
            <ChevronsUpDown className="h-3.5 w-3.5 shrink-0 opacity-40" />
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-60 p-1" align="start">
        <div className="max-h-72 overflow-y-auto">
          <button
            type="button"
            onClick={() => elegir("todos")}
            className={cn(
              "flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-xs hover:bg-accent",
              !activo && "bg-accent/60"
            )}
          >
            {!activo ? <Check className="h-3 w-3 shrink-0" /> : <span className="h-3 w-3 shrink-0" />}
            <span>Todos los productores</span>
          </button>

          {sinProductor > 0 && (
            <button
              type="button"
              onClick={() => elegir(SIN_PRODUCTOR)}
              className={cn(
                "flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-xs hover:bg-accent",
                value === SIN_PRODUCTOR && "bg-accent/60"
              )}
            >
              {value === SIN_PRODUCTOR ? (
                <Check className="h-3 w-3 shrink-0" />
              ) : (
                <span className="h-3 w-3 shrink-0" />
              )}
              <span className="min-w-0 flex-1 truncate text-muted-foreground">Sin productor</span>
              <span className="shrink-0 text-[10px] tabular-nums text-muted-foreground">
                {sinProductor}
              </span>
            </button>
          )}

          {nombres.length === 0 ? (
            <p className="px-2 py-3 text-xs text-muted-foreground">
              Ningún evento tiene productor asignado todavía.
            </p>
          ) : (
            nombres.map((n) => {
              const marcado = value.toLowerCase() === n.nombre.toLowerCase();
              return (
                <button
                  key={n.nombre}
                  type="button"
                  onClick={() => elegir(n.nombre)}
                  className={cn(
                    "flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-xs hover:bg-accent",
                    marcado && "bg-accent/60"
                  )}
                >
                  {marcado ? (
                    <Check className="h-3 w-3 shrink-0" />
                  ) : (
                    <UserCog className="h-3 w-3 shrink-0 opacity-40" />
                  )}
                  <span className="min-w-0 flex-1 truncate">{n.nombre}</span>
                  <span className="shrink-0 text-[10px] tabular-nums text-muted-foreground">
                    {n.total}
                  </span>
                </button>
              );
            })
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

export default FiltroProductor;
