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
          title={nombre ? `Color: ${nombre}` : "Poner color a la fila"}
          aria-label={nombre ? `Color: ${nombre}` : "Poner color a la fila"}
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
          Color de la fila
        </div>

        <div className="grid grid-cols-5 gap-1.5">
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
                  "flex h-7 w-7 items-center justify-center rounded-md border transition-transform hover:scale-110",
                  elegido ? "border-foreground" : "border-transparent"
                )}
                style={{ backgroundColor: color.valor }}
              >
                {elegido && <Check className="h-3.5 w-3.5 text-white drop-shadow" />}
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
          Quitar color
        </button>
      </PopoverContent>
    </Popover>
  );
}
