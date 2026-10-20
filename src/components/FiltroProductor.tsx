import { useMemo, useState } from "react";
import { Check, ChevronsUpDown, UserCog, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { Project } from "@/types";
import { listaDeProductores } from "@/components/ProductorSelect";
import { useUsuariosRegistrados } from "@/hooks/useUsuariosRegistrados";

/** Valor especial: eventos que no tienen productor asignado. */
export const SIN_PRODUCTOR = "__sin_productor__";

/**
 * Valor especial: eventos cuyo productor es un nombre escrito a mano que no
 * corresponde a ningun usuario registrado ("Mike", "DIEGO", "SSS").
 *
 * El desplegable ya no los lista uno por uno, pero si no quedara forma de
 * llegar a ellos esos eventos se volverian invisibles y nadie los arreglaria.
 * Van todos juntos bajo una sola entrada.
 */
export const OTROS_NOMBRES = "__otros_nombres__";

const normalizar = (t: string) =>
  (t || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();

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
export function pasaFiltroDeProductor(
  proyecto: Project,
  filtro: string,
  usuariosRegistrados?: string[]
): boolean {
  if (!filtro || filtro === "todos") return true;
  const productores = listaDeProductores(proyecto.productor);
  if (filtro === SIN_PRODUCTOR) return productores.length === 0;
  if (filtro === OTROS_NOMBRES) {
    if (productores.length === 0) return false;
    const registrados = new Set((usuariosRegistrados || []).map(normalizar));
    return productores.some((n) => !registrados.has(normalizar(n)));
  }
  return productores.some((n) => n.toLowerCase() === filtro.toLowerCase());
}

/**
 * Filtra la tabla por productor encargado.
 *
 * El desplegable lista los USUARIOS REGISTRADOS, no los nombres que aparecen
 * escritos en los eventos. El campo productor venia siendo texto libre y se
 * habia llenado de nombres sueltos ("Mike", "DIEGO", "SSS", "abraham
 * prueba"), que ensuciaban la lista y repartian los eventos de una misma
 * persona en dos entradas distintas.
 *
 * Al lado de cada nombre va cuantos eventos tiene. Los que no tienen ninguno
 * se muestran apagados: siguen estando, para poder confirmar de un vistazo
 * que a esa persona no le han asignado nada, pero se nota que llevan a una
 * tabla vacia.
 */
export function FiltroProductor({
  proyectos,
  value,
  onChange,
  compacto = false,
}: FiltroProductorProps) {
  const [abierto, setAbierto] = useState(false);

  const { usuarios } = useUsuariosRegistrados();

  const { nombres, sinProductor, otros } = useMemo(() => {
    const cuenta = new Map<string, number>();
    const registrados = new Set(usuarios.map((u) => normalizar(u.nombre)));
    let sin = 0;
    let fuera = 0;
    for (const p of proyectos) {
      if (p.isDeleted) continue;
      const productores = listaDeProductores(p.productor);
      if (productores.length === 0) {
        sin += 1;
        continue;
      }
      let tieneAlgunoFuera = false;
      for (const n of productores) {
        const clave = normalizar(n);
        if (registrados.has(clave)) cuenta.set(clave, (cuenta.get(clave) ?? 0) + 1);
        else tieneAlgunoFuera = true;
      }
      if (tieneAlgunoFuera) fuera += 1;
    }
    return {
      nombres: usuarios
        .map((u) => ({ nombre: u.nombre, total: cuenta.get(normalizar(u.nombre)) ?? 0 }))
        .sort((a, b) => a.nombre.localeCompare(b.nombre, "es")),
      sinProductor: sin,
      otros: fuera,
    };
  }, [proyectos, usuarios]);

  const activo = Boolean(value && value !== "todos");
  const etiqueta =
    value === SIN_PRODUCTOR
      ? "Sin productor"
      : value === OTROS_NOMBRES
        ? "Otros nombres"
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
              No hay usuarios con nombre registrado. Se les pone el nombre en
              Gestión de Usuarios.
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
                  <span
                    className={cn(
                      "min-w-0 flex-1 truncate",
                      n.total === 0 && "text-muted-foreground"
                    )}
                  >
                    {n.nombre}
                  </span>
                  <span className="shrink-0 text-[10px] tabular-nums text-muted-foreground">
                    {n.total}
                  </span>
                </button>
              );
            })
          )}

          {otros > 0 && (
            <button
              type="button"
              onClick={() => elegir(OTROS_NOMBRES)}
              title="Eventos con un productor escrito a mano que no corresponde a ningún usuario registrado"
              className={cn(
                "mt-1 flex w-full items-center gap-2 rounded border-t px-2 py-1.5 text-left text-xs hover:bg-accent",
                value === OTROS_NOMBRES && "bg-accent/60"
              )}
            >
              {value === OTROS_NOMBRES ? (
                <Check className="h-3 w-3 shrink-0" />
              ) : (
                <span className="h-3 w-3 shrink-0" />
              )}
              <span className="min-w-0 flex-1 truncate text-muted-foreground">
                Otros nombres
              </span>
              <span className="shrink-0 text-[10px] tabular-nums text-muted-foreground">
                {otros}
              </span>
            </button>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

export default FiltroProductor;
