import { useEffect, useMemo, useState } from "react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { parseISO, startOfMonth, subMonths, isAfter } from "date-fns";
import { Project } from "@/types";

interface GraficaClientesProps {
  projects: Project[];
  /** Mismo periodo que la pestaña de comerciales, para que no se contradigan. */
  meses?: number;
}

/**
 * Rampa ordinal de un solo azul, validada con scripts/validate_palette.js del
 * skill de dataviz (modo ordinal, claro y oscuro): 5 pasos es el maximo que
 * pasa la separacion de luminosidad. De ahi sale el tope de porciones.
 *
 * En claro la porcion mayor va oscura; en oscuro va clara. En los dos casos la
 * mayor es la que mas contrasta contra el fondo.
 */
const RAMPA_CLARO = ["#0d366b", "#184f95", "#256abf", "#3987e5", "#86b6ef"];
const RAMPA_OSCURO = ["#cde2fb", "#9ec5f4", "#6da7ec", "#2a78d6", "#184f95"];

/**
 * Cuantas porciones llevan nombre propio. Cinco es el tope que aguanta la
 * rampa; "Otros" no gasta uno de esos cinco porque va en gris: no es un
 * cliente, es el resto, y pintarlo del mismo azul lo hacia parecer el mayor.
 */
const PORCIONES = 5;

/** Gris del "Otros". No sale de la rampa a proposito. */
const GRIS_CLARO = "#6e6d67";
const GRIS_OSCURO = "#8a8982";

const pesos = new Intl.NumberFormat("es-CO", {
  style: "currency",
  currency: "COP",
  maximumFractionDigits: 0,
});

function aFecha(valor?: string | null): Date | null {
  if (!valor) return null;
  try {
    const d = parseISO(valor.length > 10 ? valor : `${valor}T00:00:00`);
    return isNaN(d.getTime()) ? null : d;
  } catch {
    return null;
  }
}

interface FilaCliente {
  nombre: string;
  valor: number;
  eventos: number;
  porcentaje: number;
}

export function GraficaClientes({ projects, meses = 12 }: GraficaClientesProps) {
  const [oscuro, setOscuro] = useState(false);
  useEffect(() => {
    const mirar = () => setOscuro(document.documentElement.classList.contains("dark"));
    mirar();
    const obs = new MutationObserver(mirar);
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    return () => obs.disconnect();
  }, []);

  const { filas, total, sinCliente } = useMemo(() => {
    const desde = startOfMonth(subMonths(new Date(), meses - 1));
    const porCliente = new Map<string, FilaCliente>();
    let anonimo = 0;

    projects.forEach((p) => {
      if (p.isDeleted) return;
      const fecha = aFecha(p.fechaEjecucionInicio);
      if (!fecha || !isAfter(fecha, subMonths(desde, 1))) return;

      const monto = Number(p.ingresoTotal) || 0;
      if (monto <= 0) return;

      const nombre = (p.cliente || "").trim();
      if (!nombre) {
        anonimo += monto;
        return;
      }
      // Se agrupa sin distinguir mayusculas ni tildes: "compumundo" y
      // "COMPUMUNDO" son el mismo cliente, y si se separan las dos cifras
      // quedan mal las dos.
      const clave = nombre
        .toLowerCase()
        .normalize("NFD")
        .replace(/[̀-ͯ]/g, "");
      const actual = porCliente.get(clave);
      if (actual) {
        actual.valor += monto;
        actual.eventos += 1;
      } else {
        porCliente.set(clave, { nombre, valor: monto, eventos: 1, porcentaje: 0 });
      }
    });

    const lista = [...porCliente.values()].sort((a, b) => b.valor - a.valor);
    const suma = lista.reduce((s, f) => s + f.valor, 0) + anonimo;
    lista.forEach((f) => {
      f.porcentaje = suma > 0 ? (f.valor / suma) * 100 : 0;
    });

    return { filas: lista, total: suma, sinCliente: anonimo };
  }, [projects, meses]);

  // La torta solo aguanta unas pocas porciones antes de volverse ilegible; el
  // detalle completo vive en la tabla de abajo.
  const porciones = useMemo(() => {
    const cabeza = filas.slice(0, PORCIONES);
    const cola = filas.slice(PORCIONES);
    const resto = cola.reduce((s, f) => s + f.valor, 0) + sinCliente;
    const trozos: { nombre: string; valor: number; esOtros?: boolean }[] =
      cabeza.map((f) => ({ nombre: f.nombre, valor: f.valor }));
    if (resto > 0) {
      trozos.push({
        nombre: `Otros (${cola.length + (sinCliente > 0 ? 1 : 0)})`,
        valor: resto,
        esOtros: true,
      });
    }
    return trozos;
  }, [filas, sinCliente]);

  const rampa = oscuro ? RAMPA_OSCURO : RAMPA_CLARO;
  const gris = oscuro ? GRIS_OSCURO : GRIS_CLARO;
  const colorDe = (i: number, esOtros?: boolean) =>
    esOtros ? gris : rampa[Math.min(i, rampa.length - 1)];

  if (filas.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border p-8 text-center">
        <p className="text-sm font-medium">No hay ventas en el periodo</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Se cuentan los eventos con ingreso, por su mes de ejecución, en los
          últimos {meses} meses.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="rounded-lg border border-border p-3">
        <div className="text-xs text-muted-foreground">Total facturado a clientes</div>
        <div className="mt-0.5 text-2xl font-semibold tabular-nums">{pesos.format(total)}</div>
        <div className="text-[11px] text-muted-foreground">
          {filas.length} cliente{filas.length === 1 ? "" : "s"} en los últimos {meses} meses
        </div>
      </div>

      <div className="h-[230px] w-full sm:h-[260px]">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={porciones}
              dataKey="valor"
              nameKey="nombre"
              innerRadius="45%"
              outerRadius="78%"
              paddingAngle={2}
              stroke="hsl(var(--background))"
              strokeWidth={2}
              isAnimationActive={false}
            >
              {porciones.map((t, i) => (
                <Cell key={i} fill={colorDe(i, t.esOtros)} />
              ))}
            </Pie>
            <Tooltip
              formatter={(valor: number, nombre: string) => [
                `${pesos.format(valor)} · ${total > 0 ? ((valor / total) * 100).toFixed(1) : 0}%`,
                nombre,
              ]}
              contentStyle={{
                background: "hsl(var(--popover))",
                border: "1px solid hsl(var(--border))",
                borderRadius: 8,
                fontSize: 12,
                color: "hsl(var(--popover-foreground))",
              }}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>

      {/* Leyenda propia: la de recharts corta los nombres largos de cliente. */}
      <div className="flex flex-wrap gap-x-4 gap-y-1.5">
        {porciones.map((t, i) => (
          <span key={t.nombre} className="flex items-center gap-1.5 text-xs">
            <span
              className="h-2.5 w-2.5 shrink-0 rounded-sm"
              style={{ backgroundColor: colorDe(i, t.esOtros) }}
            />
            <span className="text-foreground">{t.nombre}</span>
            <span className="tabular-nums text-muted-foreground">
              {total > 0 ? ((t.valor / total) * 100).toFixed(1) : 0}%
            </span>
          </span>
        ))}
      </div>

      {/* La torta da la forma; esto da el dato exacto, que es lo que se copia a
          un informe. Salen todos los clientes, no solo los de la torta. */}
      <div className="max-h-[260px] overflow-auto rounded-lg border border-border">
        <table className="w-full min-w-[420px] text-sm">
          <thead className="sticky top-0 bg-muted/80 backdrop-blur">
            <tr className="text-left">
              <th className="px-3 py-2 font-medium">Cliente</th>
              <th className="px-3 py-2 text-right font-medium">Eventos</th>
              <th className="px-3 py-2 text-right font-medium">Valor</th>
              <th className="px-3 py-2 text-right font-medium">%</th>
            </tr>
          </thead>
          <tbody>
            {filas.map((f) => (
              <tr key={f.nombre} className="border-t border-border/60">
                <td className="px-3 py-1.5">{f.nombre}</td>
                <td className="px-3 py-1.5 text-right tabular-nums text-muted-foreground">
                  {f.eventos}
                </td>
                <td className="whitespace-nowrap px-3 py-1.5 text-right tabular-nums">{pesos.format(f.valor)}</td>
                <td className="whitespace-nowrap px-3 py-1.5 text-right tabular-nums">{f.porcentaje.toFixed(1)}%</td>
              </tr>
            ))}
            {sinCliente > 0 && (
              <tr className="border-t border-border/60 text-muted-foreground">
                <td className="px-3 py-1.5 italic">Sin cliente anotado</td>
                <td className="px-3 py-1.5" />
                <td className="whitespace-nowrap px-3 py-1.5 text-right tabular-nums">{pesos.format(sinCliente)}</td>
                <td className="px-3 py-1.5 text-right tabular-nums">
                  {total > 0 ? ((sinCliente / total) * 100).toFixed(1) : 0}%
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <p className="text-[11px] text-muted-foreground">
        Es el valor de venta de los eventos, por su mes de ejecución. No dice si
        ya se cobró. La torta muestra los {PORCIONES} clientes más grandes y junta
        el resto en gris; si ese gris pesa más que las porciones con nombre, es
        que la facturación está repartida y la tabla dice más que el dibujo.
      </p>
    </div>
  );
}

export default GraficaClientes;
