import { Check, ChevronsUpDown, UserCog, Users } from "lucide-react";
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

/**
 * Elige los productores encargados entre los usuarios registrados.
 *
 * Un evento puede tener dos o mas productores, o ninguno. Los nombres se
 * guardan en el mismo campo de texto, separados por coma, y no en una tabla
 * aparte: el campo ya lo leen el Panel General, Operaciones, la ficha del
 * evento, la orden de produccion y los filtros, y todos lo tratan como texto.
 * Partirlo en una tabla obligaria a tocar cada uno de esos sitios para ganar
 * consultas que hoy nadie hace.
 *
 * Deja ver un nombre que no esta en la lista en vez de borrarlo: el campo venia
 * siendo texto libre, asi que hay eventos con nombres escritos a mano. Se
 * marcan, para que se note cuales falta normalizar, pero no se pierden.
 */

/** "Diego, Carolina" -> ["Diego", "Carolina"]. Sin vacios ni repetidos. */
export function listaDeProductores(valor?: string): string[] {
  const vistos = new Set<string>();
  return (valor || "")
    .split(",")
    .map((n) => n.trim())
    .filter((n) => {
      if (!n || vistos.has(n.toLowerCase())) return false;
      vistos.add(n.toLowerCase());
      return true;
    });
}

/** Como se ve en una casilla angosta: el primero, y cuantos mas hay. */
function resumen(nombres: string[]): string {
  if (nombres.length === 0) return "Sin productor";
  if (nombres.length === 1) return nombres[0];
  return `${nombres[0]} +${nombres.length - 1}`;
}

export function ProductorSelect({ value, onChange, disabled = false }: ProductorSelectProps) {
  const { usuarios, cargando } = useUsuariosRegistrados();
  const [abierto, setAbierto] = useState(false);

  const elegidos = listaDeProductores(value);
  const hay = elegidos.length > 0;
  // Todos los nombres, uno por renglon: en la casilla solo cabe el resumen.
  const tituloCompleto = hay ? elegidos.join("\n") : "Sin productor asignado";

  // Fuera del Panel Directivo el productor se mira, no se toca. Se dice de
  // donde sale, para que quien lo necesite cambiar sepa a quien pedirselo en
  // vez de creer que la casilla esta danada.
  if (disabled) {
    return (
      <span
        className="flex min-w-0 items-center gap-1 text-xs"
        title={
          hay
            ? `${tituloCompleto}\n\nLo asigna el Panel Directivo`
            : "Sin productor. Lo asigna el Panel Directivo."
        }
      >
        {elegidos.length > 1 ? (
          <Users className="h-3 w-3 shrink-0 opacity-40" />
        ) : (
          <UserCog className="h-3 w-3 shrink-0 opacity-40" />
        )}
        <span className={cn("truncate", !hay && "text-muted-foreground")}>
          {resumen(elegidos)}
        </span>
      </span>
    );
  }

  /** Marca o desmarca un nombre. El menu no se cierra: casi siempre van dos. */
  const alternar = (nombre: string) => {
    const quitando = elegidos.some((n) => n.toLowerCase() === nombre.toLowerCase());
    const nuevos = quitando
      ? elegidos.filter((n) => n.toLowerCase() !== nombre.toLowerCase())
      : [...elegidos, nombre];
    onChange(nuevos.join(", "));
  };

  const dejarSinProductor = () => {
    onChange("");
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
          title={tituloCompleto}
        >
          <span className="flex min-w-0 items-center gap-1">
            {elegidos.length > 1 && <Users className="h-3 w-3 shrink-0 opacity-40" />}
            <span className={cn("truncate", !hay && "text-muted-foreground")}>
              {resumen(elegidos)}
            </span>
          </span>
          <ChevronsUpDown className="h-3 w-3 shrink-0 opacity-40" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-60 p-1"
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
            <p className="px-2 pb-1 pt-1.5 text-[10px] uppercase tracking-wide text-muted-foreground">
              Puedes marcar varios
            </p>

            <button
              type="button"
              onClick={dejarSinProductor}
              className={cn(
                "flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-xs hover:bg-accent",
                !hay && "bg-accent/60"
              )}
            >
              <span className="h-3 w-3 shrink-0" />
              <span className="text-muted-foreground">Sin productor</span>
            </button>

            {/* Un nombre escrito a mano que no corresponde a ningun usuario:
                se deja a la vista para poder conservarlo o quitarlo. */}
            {elegidos
              .filter((n) => !usuarios.some((u) => u.nombre === n))
              .map((n) => (
                <button
                  key={`a-mano-${n}`}
                  type="button"
                  onClick={() => alternar(n)}
                  className="flex w-full items-center gap-2 rounded bg-accent/60 px-2 py-1.5 text-left text-xs hover:bg-accent"
                >
                  <Check className="h-3 w-3 shrink-0" />
                  <span className="min-w-0 flex-1 truncate">{n}</span>
                  <span className="shrink-0 text-[10px] text-muted-foreground">a mano</span>
                </button>
              ))}

            {usuarios.map((u) => {
              const marcado = elegidos.some(
                (n) => n.toLowerCase() === u.nombre.toLowerCase()
              );
              return (
                <button
                  key={u.id}
                  type="button"
                  onClick={() => alternar(u.nombre)}
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
                  <span className="truncate">{u.nombre}</span>
                </button>
              );
            })}
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}

export default ProductorSelect;
