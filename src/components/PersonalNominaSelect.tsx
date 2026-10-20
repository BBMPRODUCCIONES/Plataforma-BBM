import { useMemo, useState } from "react";
import { Check, ChevronsUpDown, Users, User, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { useEmpleados } from "@/contexts/EmpleadosContext";
import { useUsuariosRegistrados } from "@/hooks/useUsuariosRegistrados";
import { PersonalItem } from "@/types";

/**
 * Marca quien del equipo trabajo en el evento.
 *
 * La lista sale de los USUARIOS REGISTRADOS, los mismos de Gestion de
 * Usuarios y del selector de productor. No de la tabla de empleados: ahi
 * quedaron veintiocho registros, la mayoria creados con el correo como
 * nombre ("diego.hurtado.bbm0", "bbmtablet0"), duplicados entre si, y elegir
 * a alguien de esa lista era adivinar.
 *
 * Escribe en el mismo campo `personal` que ya tenia el evento, no en uno
 * nuevo: ahi estan los registros cargados antes desde Panel Operaciones, y
 * tener el mismo dato en dos sitios termina con dos listas que no coinciden.
 *
 * Por eso solo toca las lineas de tipo BBM. Las de Proveedor y Transporte se
 * quedan como esten: no salen en este selector y marcarlo o desmarcarlo nunca
 * las borra.
 */

interface PersonalNominaSelectProps {
  value?: PersonalItem[];
  onChange: (personal: PersonalItem[]) => void;
  disabled?: boolean;
}

const normalizar = (t: string) =>
  (t || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();

/** Las lineas de nomina (BBM) de un evento, en el orden en que estan. */
export function personalDeNomina(personal?: PersonalItem[]): PersonalItem[] {
  return (personal || []).filter((p) => p.tipoPersonal === "BBM");
}

/** Como se ve en una casilla angosta: el primero, y cuantos mas hay. */
function resumen(items: PersonalItem[]): string {
  const nombres = items.map((p) => p.nombre).filter(Boolean);
  if (nombres.length === 0) return "Sin personal";
  if (nombres.length === 1) return nombres[0];
  return `${nombres[0]} +${nombres.length - 1}`;
}

export function PersonalNominaSelect({
  value,
  onChange,
  disabled = false,
}: PersonalNominaSelectProps) {
  const { usuarios, cargando } = useUsuariosRegistrados();
  const { empleados } = useEmpleados();
  const [abierto, setAbierto] = useState(false);
  const [busqueda, setBusqueda] = useState("");

  const todas = value || [];
  const deNomina = personalDeNomina(todas);
  const hay = deNomina.length > 0;
  const tituloCompleto = hay
    ? deNomina.map((p) => (p.cargo ? `${p.nombre} - ${p.cargo}` : p.nombre)).join("\n")
    : "Sin personal asignado";

  // Con una docena de personas, bajar rodando es mas lento que escribir el
  // nombre. Busca tambien por correo: hay usuarios que se llaman "Bodega" o
  // "Contabilidad" y el correo es lo unico que dice quien es.
  const visibles = useMemo(() => {
    const t = normalizar(busqueda);
    if (!t) return usuarios;
    return usuarios.filter(
      (u) => normalizar(u.nombre).includes(t) || normalizar(u.correo || "").includes(t)
    );
  }, [usuarios, busqueda]);

  const estaMarcado = (nombre: string) =>
    deNomina.some((p) => normalizar(p.nombre) === normalizar(nombre));

  if (disabled) {
    return (
      <span className="flex min-w-0 items-center gap-1 text-xs" title={tituloCompleto}>
        {deNomina.length > 1 ? (
          <Users className="h-3 w-3 shrink-0 opacity-40" />
        ) : (
          <User className="h-3 w-3 shrink-0 opacity-40" />
        )}
        <span className={cn("truncate", !hay && "text-muted-foreground")}>
          {resumen(deNomina)}
        </span>
      </span>
    );
  }

  /**
   * Marca o desmarca a alguien. El menu no se cierra: en un montaje casi
   * siempre se marcan varios seguidos.
   */
  const alternar = (usuarioId: string) => {
    const u = usuarios.find((x) => x.id === usuarioId);
    if (!u) return;

    if (estaMarcado(u.nombre)) {
      onChange(
        todas.filter(
          (p) => p.tipoPersonal !== "BBM" || normalizar(p.nombre) !== normalizar(u.nombre)
        )
      );
      return;
    }

    // Se amarra con la ficha de empleado por CORREO, no por nombre: el usuario
    // se llama "Abraham Varela" y su ficha quedo como "abraham.varela", pero
    // el correo es el mismo. Ese vinculo es el que deja que los horarios
    // sigan reconociendo a la persona. Si no hay ficha, se guarda el nombre y
    // ya; el evento queda bien y la ficha se crea despues si hace falta.
    const ficha = u.correo
      ? empleados.find((e) => normalizar(e.correo || "") === normalizar(u.correo || ""))
      : undefined;

    const nuevo: PersonalItem = {
      id: `p${Date.now()}${Math.random().toString(36).slice(2, 6)}`,
      tipoPersonal: "BBM",
      nombre: u.nombre,
      cargo: ficha?.cargo || "",
      telefono: ficha?.telefono || "",
      ...(ficha ? { empleadoId: ficha.id } : {}),
      ...(ficha?.cedula ? { cedula: ficha.cedula, cedulaOrigen: "empleado" as const } : {}),
    };
    onChange([...todas, nuevo]);
  };

  const dejarSinPersonal = () => {
    // Solo se van las de nomina. Proveedor y Transporte siguen ahi.
    onChange(todas.filter((p) => p.tipoPersonal !== "BBM"));
    setAbierto(false);
  };

  const otros = todas.length - deNomina.length;
  // Un nombre que quedo escrito antes y que ya no corresponde a ningun
  // usuario: se deja a la vista para poder conservarlo o quitarlo, en vez de
  // desaparecerlo sin avisar.
  const aMano = deNomina.filter(
    (p) => !usuarios.some((u) => normalizar(u.nombre) === normalizar(p.nombre))
  );

  return (
    <Popover
      open={abierto}
      onOpenChange={(v) => {
        setAbierto(v);
        if (!v) setBusqueda("");
      }}
    >
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 w-full justify-between gap-1 px-1.5 text-xs font-normal"
          onClick={(e) => e.stopPropagation()}
          title={tituloCompleto}
        >
          <span className="flex min-w-0 items-center gap-1">
            {deNomina.length > 1 && <Users className="h-3 w-3 shrink-0 opacity-40" />}
            <span className={cn("truncate", !hay && "text-muted-foreground")}>
              {resumen(deNomina)}
            </span>
          </span>
          <ChevronsUpDown className="h-3 w-3 shrink-0 opacity-40" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-1" align="start" onClick={(e) => e.stopPropagation()}>
        {cargando ? (
          <p className="px-2 py-3 text-xs text-muted-foreground">Cargando usuarios...</p>
        ) : usuarios.length === 0 ? (
          <p className="px-2 py-3 text-xs text-muted-foreground">
            No hay usuarios con nombre registrado. Ponles el nombre en Gestion de
            Usuarios y apareceran aqui.
          </p>
        ) : (
          <div>
            <p className="px-2 pb-1 pt-1.5 text-[10px] uppercase tracking-wide text-muted-foreground">
              Quienes trabajaron en el evento
            </p>

            <div className="relative px-1 pb-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                autoFocus
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                placeholder="Buscar persona..."
                className="h-8 pl-8 text-xs"
              />
            </div>

            <div className="max-h-64 overflow-y-auto">
              {!busqueda && (
                <button
                  type="button"
                  onClick={dejarSinPersonal}
                  className={cn(
                    "flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-xs hover:bg-accent",
                    !hay && "bg-accent/60"
                  )}
                >
                  <span className="h-3 w-3 shrink-0" />
                  <span className="text-muted-foreground">Sin personal</span>
                </button>
              )}

              {!busqueda &&
                aMano.map((p) => (
                  <button
                    key={`a-mano-${p.id}`}
                    type="button"
                    onClick={() =>
                      onChange(todas.filter((x) => x.id !== p.id))
                    }
                    className="flex w-full items-center gap-2 rounded bg-accent/60 px-2 py-1.5 text-left text-xs hover:bg-accent"
                    title="Nombre guardado antes que ya no corresponde a ningun usuario"
                  >
                    <Check className="h-3 w-3 shrink-0" />
                    <span className="min-w-0 flex-1 truncate">{p.nombre}</span>
                    <span className="shrink-0 text-[10px] text-muted-foreground">
                      a mano
                    </span>
                  </button>
                ))}

              {visibles.map((u) => {
                const marcado = estaMarcado(u.nombre);
                return (
                  <button
                    key={u.id}
                    type="button"
                    onClick={() => alternar(u.id)}
                    className={cn(
                      "flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-xs hover:bg-accent",
                      marcado && "bg-accent/60"
                    )}
                    title={u.correo || u.nombre}
                  >
                    {marcado ? (
                      <Check className="h-3 w-3 shrink-0" />
                    ) : (
                      <User className="h-3 w-3 shrink-0 opacity-40" />
                    )}
                    <span className="min-w-0 flex-1 truncate">{u.nombre}</span>
                  </button>
                );
              })}

              {busqueda && visibles.length === 0 && (
                <p className="px-2 py-3 text-xs text-muted-foreground">
                  Nadie coincide con "{busqueda}".
                </p>
              )}
            </div>

            {otros > 0 && (
              <p className="border-t px-2 pb-1 pt-1.5 text-[10px] text-muted-foreground">
                Este evento tambien tiene {otros} linea{otros === 1 ? "" : "s"} de
                proveedor o transporte. No se tocan desde aqui.
              </p>
            )}
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}

export default PersonalNominaSelect;
