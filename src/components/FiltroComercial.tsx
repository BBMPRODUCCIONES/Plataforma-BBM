import { useMemo, useState } from "react";
import { Check, ChevronsUpDown, Palette, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { Project } from "@/types";
import { COLORES_DE_COMERCIAL, colorVisualDeEvento } from "@/lib/coloresProyecto";

/** Valor especial: eventos que no son de ningun comercial. */
export const SIN_COMERCIAL = "__sin_comercial__";

/**
 * Filtra por comercial, que es lo que dice el color de la fila.
 *
 * Se usa el mismo criterio que para pintar: manda el color puesto a mano y,
 * si no hay, el que sale del correo de quien subio el evento. De otra forma
 * el filtro y lo que se ve en pantalla dirian cosas distintas, y hoy la
 * mayoria de eventos no tienen color a mano.
 */
export function pasaFiltroDeComercial(proyecto: Project, filtro: string): boolean {
  if (!filtro || filtro === "todos") return true;
  const visual = colorVisualDeEvento(proyecto);
  const comercial = COLORES_DE_COMERCIAL.find(
    (c) => visual && c.valor.toLowerCase() === visual.color.toLowerCase()
  );
  if (filtro === SIN_COMERCIAL) return !comercial;
  return comercial?.comercial?.toLowerCase() === filtro.toLowerCase();
}

interface FiltroComercialProps {
  proyectos: Project[];
  value: string;
  onChange: (valor: string) => void;
  compacto?: boolean;
}

export function FiltroComercial({
  proyectos,
  value,
  onChange,
  compacto = false,
}: FiltroComercialProps) {
  const [abierto, setAbierto] = useState(false);

  const { cuentas, sinComercial } = useMemo(() => {
    const mapa = new Map<string, number>();
    let sin = 0;
    for (const p of proyectos) {
      if (p.isDeleted) continue;
      const visual = colorVisualDeEvento(p);
      const comercial = COLORES_DE_COMERCIAL.find(
        (c) => visual && c.valor.toLowerCase() === visual.color.toLowerCase()
      );
      if (!comercial?.comercial) {
        sin += 1;
        continue;
      }
      mapa.set(comercial.comercial, (mapa.get(comercial.comercial) ?? 0) + 1);
    }
    return { cuentas: mapa, sinComercial: sin };
  }, [proyectos]);

  const activo = Boolean(value && value !== "todos");
  const etiqueta =
    value === SIN_COMERCIAL ? "Sin comercial" : activo ? value : "Comercial";

  const elegir = (v: string) => {
    onChange(v);
    setAbierto(false);
  };

  const colorActivo = COLORES_DE_COMERCIAL.find(
    (c) => c.comercial?.toLowerCase() === value.toLowerCase()
  );

  return (
    <Popover open={abierto} onOpenChange={setAbierto}>
      <PopoverTrigger asChild>
        <Button
          variant={activo ? "default" : "outline"}
          size="sm"
          className={cn(
            "gap-1.5 whitespace-nowrap text-xs",
            compacto ? "h-8 px-2.5" : "h-9"
          )}
          title={activo ? `Filtrando por ${etiqueta}` : "Filtrar por comercial"}
        >
          {colorActivo ? (
            <span
              className="h-2.5 w-2.5 shrink-0 rounded-full"
              style={{ backgroundColor: colorActivo.valor }}
            />
          ) : (
            <Palette className="h-3.5 w-3.5 shrink-0" />
          )}
          <span className="truncate">{etiqueta}</span>
          {activo ? (
            <span
              role="button"
              tabIndex={-1}
              aria-label="Quitar el filtro de comercial"
              onClick={(e) => {
                e.stopPropagation();
                onChange("todos");
              }}
              className="shrink-0 rounded-sm opacity-70 hover:opacity-100"
            >
              <X className="h-3.5 w-3.5" />
            </span>
          ) : (
            <ChevronsUpDown className="h-3.5 w-3.5 shrink-0 opacity-40" />
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-56 p-1" align="start">
        <button
          type="button"
          onClick={() => elegir("todos")}
          className={cn(
            "flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-xs hover:bg-accent",
            !activo && "bg-accent/60"
          )}
        >
          {!activo ? (
            <Check className="h-3 w-3 shrink-0" />
          ) : (
            <span className="h-3 w-3 shrink-0" />
          )}
          <span>Todos los comerciales</span>
        </button>

        {COLORES_DE_COMERCIAL.map((c) => {
          const nombre = c.comercial as string;
          const marcado = value.toLowerCase() === nombre.toLowerCase();
          const total = cuentas.get(nombre) ?? 0;
          return (
            <button
              key={c.valor}
              type="button"
              onClick={() => elegir(nombre)}
              className={cn(
                "flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-xs hover:bg-accent",
                marcado && "bg-accent/60"
              )}
            >
              {marcado ? (
                <Check className="h-3 w-3 shrink-0" />
              ) : (
                <span
                  className="h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: c.valor }}
                />
              )}
              <span
                className={cn("min-w-0 flex-1 truncate", total === 0 && "text-muted-foreground")}
              >
                {nombre}
              </span>
              <span className="shrink-0 text-[10px] tabular-nums text-muted-foreground">
                {total}
              </span>
            </button>
          );
        })}

        {sinComercial > 0 && (
          <button
            type="button"
            onClick={() => elegir(SIN_COMERCIAL)}
            title="Eventos sin color propio y que no subió ningún comercial"
            className={cn(
              "mt-1 flex w-full items-center gap-2 rounded border-t px-2 py-1.5 text-left text-xs hover:bg-accent",
              value === SIN_COMERCIAL && "bg-accent/60"
            )}
          >
            {value === SIN_COMERCIAL ? (
              <Check className="h-3 w-3 shrink-0" />
            ) : (
              <span className="h-3 w-3 shrink-0" />
            )}
            <span className="min-w-0 flex-1 truncate text-muted-foreground">
              Sin comercial
            </span>
            <span className="shrink-0 text-[10px] tabular-nums text-muted-foreground">
              {sinComercial}
            </span>
          </button>
        )}
      </PopoverContent>
    </Popover>
  );
}

export default FiltroComercial;
