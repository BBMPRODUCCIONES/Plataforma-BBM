import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Palette, Check, Ban } from "lucide-react";
import { COLORES_PROYECTO, nombreDeColor } from "@/lib/coloresProyecto";
import { cn } from "@/lib/utils";

interface SelectorColorProyectoProps {
  /** Color guardado hoy, o vacio. */
  valor?: string | null;
  /** Se llama con el color elegido, o con null para quitarlo. */
  onCambio: (color: string | null) => void;
  disabled?: boolean;
}

/**
 * Paleta chica para marcar una fila con un color. Se usa solo en el
 * Panel Directivo; el color queda visible en todos los paneles.
 */
export function SelectorColorProyecto({ valor, onCambio, disabled }: SelectorColorProyectoProps) {
  const nombre = nombreDeColor(valor);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="h-6 w-6 p-0"
          disabled={disabled}
          title={nombre ? `Venta de ${nombre}` : "Asignar la venta"}
          aria-label={nombre ? `Venta de ${nombre}` : "Asignar la venta"}
          onClick={(e) => e.stopPropagation()}
        >
          {valor ? (
            <span
              className="h-3.5 w-3.5 rounded-full border border-border"
              style={{ backgroundColor: valor }}
            />
          ) : (
            <Palette className="h-3.5 w-3.5 text-muted-foreground" />
          )}
        </Button>
      </PopoverTrigger>

      <PopoverContent
        className="w-auto p-2"
        align="end"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-1.5 px-0.5 text-xs font-medium text-muted-foreground">
          Venta de
        </div>

        <div className="flex flex-col gap-0.5">
          {COLORES_PROYECTO.map((color) => {
            const elegido = valor?.toLowerCase() === color.valor.toLowerCase();
            return (
              <button
                key={color.valor}
                type="button"
                title={color.nombre}
                aria-label={color.nombre}
                onClick={(e) => {
                  e.stopPropagation();
                  onCambio(elegido ? null : color.valor);
                }}
                className={cn(
                  "flex items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-accent",
                  elegido && "bg-accent"
                )}
              >
                <span
                  className="h-3.5 w-3.5 shrink-0 rounded-full border border-border"
                  style={{ backgroundColor: color.valor }}
                />
                <span className="flex-1 text-left">{color.nombre}</span>
                {elegido && <Check className="h-3.5 w-3.5" />}
              </button>
            );
          })}
        </div>

        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onCambio(null);
          }}
          disabled={!valor}
          className="mt-2 flex w-full items-center gap-1.5 rounded-md px-1.5 py-1.5 text-xs text-muted-foreground hover:bg-accent disabled:opacity-50"
        >
          <Ban className="h-3.5 w-3.5" />
          Sin asignar
        </button>
      </PopoverContent>
    </Popover>
  );
}
