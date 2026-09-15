import { Check, ChevronsUpDown, UserCog } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { useUsuariosRegistrados } from "@/hooks/useUsuariosRegistrados";
import { useState } from "react";

interface ProductorSelectProps {
  value?: string;
  onChange: (nombre: string) => void;
  disabled?: boolean;
}

const SIN_ASIGNAR = "__sin_asignar__";

/**
 * Elige al productor encargado entre los usuarios registrados.
 *
 * Deja ver un valor que no esta en la lista en vez de borrarlo: el campo venia
 * siendo texto libre en Operaciones y General, asi que hay eventos con nombres
 * escritos a mano. Se marcan, para que se note cuales falta normalizar, pero no
 * se pierden.
 */
export function ProductorSelect({ value, onChange, disabled = false }: ProductorSelectProps) {
  const { usuarios, cargando } = useUsuariosRegistrados();
  const [abierto, setAbierto] = useState(false);

  const actual = (value || "").trim();
  const estaEnLaLista = usuarios.some((u) => u.nombre === actual);

  // Fuera del Panel Directivo el productor se mira, no se toca. Se dice de
  // donde sale, para que quien lo necesite cambiar sepa a quien pedirselo en
  // vez de creer que la casilla esta danada.
  if (disabled) {
    return (
      <span
        className="flex min-w-0 items-center gap-1 text-xs"
        title={
          actual
            ? `${actual} — lo asigna el Panel Directivo`
            : "Sin asignar. Lo asigna el Panel Directivo."
        }
      >
        <UserCog className="h-3 w-3 shrink-0 opacity-40" />
        <span className={cn("truncate", !actual && "text-muted-foreground")}>
          {actual || "Sin asignar"}
        </span>
      </span>
    );
  }

  const elegir = (nombre: string) => {
    onChange(nombre === SIN_ASIGNAR ? "" : nombre);
    setAbierto(false);
  };

  return (
    <Popover open={abierto} onOpenChange={setAbierto}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 w-full justify-between gap-1 px-1.5 text-xs font-normal"
          onClick={(e) => e.stopPropagation()}
          title={actual || "Sin asignar"}
        >
          <span className={cn("truncate", !actual && "text-muted-foreground")}>
            {actual || "Sin asignar"}
          </span>
          <ChevronsUpDown className="h-3 w-3 shrink-0 opacity-40" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-56 p-1"
        align="start"
        onClick={(e) => e.stopPropagation()}
      >
        {cargando ? (
          <p className="px-2 py-3 text-xs text-muted-foreground">Cargando usuarios...</p>
        ) : usuarios.length === 0 ? (
          <p className="px-2 py-3 text-xs text-muted-foreground">
            No hay usuarios con nombre registrado. Ponles el nombre en Gestión de
            Usuarios y aparecerán aquí.
          </p>
        ) : (
          <div className="max-h-64 overflow-y-auto">
            <button
              type="button"
              onClick={() => elegir(SIN_ASIGNAR)}
              className={cn(
                "flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-xs hover:bg-accent",
                !actual && "bg-accent/60"
              )}
            >
              <span className="h-3 w-3 shrink-0" />
              <span className="text-muted-foreground">Sin asignar</span>
            </button>

            {/* Un nombre escrito a mano que no corresponde a ningun usuario:
                se deja a la vista para poder conservarlo o reemplazarlo. */}
            {actual && !estaEnLaLista && (
              <button
                type="button"
                onClick={() => setAbierto(false)}
                className="flex w-full items-center gap-2 rounded bg-accent/60 px-2 py-1.5 text-left text-xs"
              >
                <Check className="h-3 w-3 shrink-0" />
                <span className="min-w-0 flex-1 truncate">{actual}</span>
                <span className="shrink-0 text-[10px] text-muted-foreground">a mano</span>
              </button>
            )}

            {usuarios.map((u) => (
              <button
                key={u.id}
                type="button"
                onClick={() => elegir(u.nombre)}
                className={cn(
                  "flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-xs hover:bg-accent",
                  u.nombre === actual && "bg-accent/60"
                )}
              >
                {u.nombre === actual ? (
                  <Check className="h-3 w-3 shrink-0" />
                ) : (
                  <UserCog className="h-3 w-3 shrink-0 opacity-40" />
                )}
                <span className="truncate">{u.nombre}</span>
              </button>
            ))}
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}

export default ProductorSelect;
