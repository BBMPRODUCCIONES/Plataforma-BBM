import { useState } from "react";
import { Check, ChevronsUpDown, Users, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { useEmpleados } from "@/contexts/EmpleadosContext";
import { PersonalItem } from "@/types";

/**
 * Marca que empleados de nomina trabajaron en el evento.
 *
 * Escribe en el mismo campo `personal` que ya tenia el evento, no en uno
 * nuevo: ahi estan los registros que se cargaron desde el Panel Operaciones, y
 * tenerlos en dos sitios distintos termina con dos listas que no coinciden y
 * nadie sabe cual vale.
 *
 * Por eso solo toca las lineas de tipo BBM. Las de Proveedor y Transporte se
 * quedan como esten: no salen en este selector y marcarlo o desmarcarlo nunca
 * las borra. Lo mismo pasa con los telefonos, cedulas, notas y adjuntos que ya
 * tenga una linea de BBM: si el empleado ya estaba, no se vuelve a escribir.
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
  const { empleados, loading } = useEmpleados();
  const [abierto, setAbierto] = useState(false);

  const todas = value || [];
  const deNomina = personalDeNomina(todas);
  const hay = deNomina.length > 0;
  const tituloCompleto = hay
    ? deNomina.map((p) => (p.cargo ? `${p.nombre} - ${p.cargo}` : p.nombre)).join("\n")
    : "Sin personal de nomina asignado";

  /** Esta este empleado ya en la lista del evento? */
  const estaMarcado = (empleadoId: string, nombre: string) =>
    deNomina.some(
      (p) =>
        (p.empleadoId && p.empleadoId === empleadoId) ||
        (!p.empleadoId && normalizar(p.nombre) === normalizar(nombre))
    );

  if (disabled) {
    return (
      <span
        className="flex min-w-0 items-center gap-1 text-xs"
        title={tituloCompleto}
      >
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
   * Marca o desmarca un empleado. El menu no se cierra: en un montaje casi
   * siempre se marcan varios seguidos.
   */
  const alternar = (empleadoId: string) => {
    const emp = empleados.find((e) => e.id === empleadoId);
    if (!emp) return;

    if (estaMarcado(emp.id, emp.nombre)) {
      onChange(
        todas.filter((p) => {
          if (p.tipoPersonal !== "BBM") return true;
          const esEste =
            (p.empleadoId && p.empleadoId === emp.id) ||
            (!p.empleadoId && normalizar(p.nombre) === normalizar(emp.nombre));
          return !esEste;
        })
      );
      return;
    }

    // Los datos de contacto llegan vacios para quien no es administrador: la
    // base los filtra. Se guarda lo que haya; el resto se completa en la
    // ficha del empleado, no aca.
    const nuevo: PersonalItem = {
      id: `p${Date.now()}${Math.random().toString(36).slice(2, 6)}`,
      empleadoId: emp.id,
      tipoPersonal: "BBM",
      nombre: emp.nombre || "",
      cargo: emp.cargo || "",
      telefono: emp.telefono || "",
      ...(emp.cedula ? { cedula: emp.cedula, cedulaOrigen: "empleado" as const } : {}),
    };
    onChange([...todas, nuevo]);
  };

  const dejarSinPersonal = () => {
    // Solo se van las de nomina. Proveedor y Transporte siguen ahi.
    onChange(todas.filter((p) => p.tipoPersonal !== "BBM"));
    setAbierto(false);
  };

  const otros = todas.length - deNomina.length;

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
            {deNomina.length > 1 && <Users className="h-3 w-3 shrink-0 opacity-40" />}
            <span className={cn("truncate", !hay && "text-muted-foreground")}>
              {resumen(deNomina)}
            </span>
          </span>
          <ChevronsUpDown className="h-3 w-3 shrink-0 opacity-40" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-64 p-1"
        align="start"
        onClick={(e) => e.stopPropagation()}
      >
        {loading ? (
          <p className="px-2 py-3 text-xs text-muted-foreground">Cargando empleados...</p>
        ) : empleados.length === 0 ? (
          <p className="px-2 py-3 text-xs text-muted-foreground">
            No hay empleados registrados. Se agregan en Empleados y aparecen aqui.
          </p>
        ) : (
          <div className="max-h-72 overflow-y-auto">
            <p className="px-2 pb-1 pt-1.5 text-[10px] uppercase tracking-wide text-muted-foreground">
              Quienes trabajaron en el evento
            </p>

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

            {empleados.map((e) => {
              const marcado = estaMarcado(e.id, e.nombre);
              return (
                <button
                  key={e.id}
                  type="button"
                  onClick={() => alternar(e.id)}
                  className={cn(
                    "flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-xs hover:bg-accent",
                    marcado && "bg-accent/60"
                  )}
                >
                  {marcado ? (
                    <Check className="h-3 w-3 shrink-0" />
                  ) : (
                    <User className="h-3 w-3 shrink-0 opacity-40" />
                  )}
                  <span className="min-w-0 flex-1 truncate">{e.nombre}</span>
                  {e.cargo && (
                    <span className="shrink-0 text-[10px] text-muted-foreground">
                      {e.cargo}
                    </span>
                  )}
                </button>
              );
            })}

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
