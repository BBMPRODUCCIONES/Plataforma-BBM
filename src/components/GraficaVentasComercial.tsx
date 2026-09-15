import { useMemo, useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { format, parseISO, startOfMonth, subMonths, isAfter } from "date-fns";
import { es } from "date-fns/locale";
import { Project } from "@/types";
import { COLORES_DE_COMERCIAL, buscarColor } from "@/lib/coloresProyecto";

interface GraficaVentasComercialProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projects: Project[];
  /** Cuantos meses hacia atras mostrar. */
  meses?: number;
}

/** "2026-09-16" o una fecha con hora -> Date local, sin corrimientos de zona. */
function aFecha(valor?: string | null): Date | null {
  if (!valor) return null;
  try {
    const d = parseISO(valor.length > 10 ? valor : `${valor}T00:00:00`);
    return isNaN(d.getTime()) ? null : d;
  } catch {
    return null;
  }
}

const pesos = new Intl.NumberFormat("es-CO", {
  style: "currency",
  currency: "COP",
  maximumFractionDigits: 0,
});

/** Millones, para los ejes: 12.500.000 -> "12,5 M" */
function millones(v: number): string {
  if (v === 0) return "0";
  return `${(v / 1_000_000).toLocaleString("es-CO", { maximumFractionDigits: 1 })} M`;
}

export function GraficaVentasComercial({
  open,
  onOpenChange,
  projects,
  meses = 12,
}: GraficaVentasComercialProps) {
  // El tema decide la paleta: el amarillo que funciona sobre blanco se apaga sobre negro.
  const [oscuro, setOscuro] = useState(false);
  useEffect(() => {
    const mirar = () => setOscuro(document.documentElement.classList.contains("dark"));
    mirar();
    const obs = new MutationObserver(mirar);
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    return () => obs.disconnect();
  }, []);

  const { datos, totales, sinAsignar, eventosSinAsignar } = useMemo(() => {
    const desde = startOfMonth(subMonths(new Date(), meses - 1));

    // Un cajon por mes, aunque el mes no tenga ventas: los huecos se ven.
    const cajones = new Map<string, Record<string, number | string>>();
    for (let i = 0; i < meses; i++) {
      const mes = startOfMonth(subMonths(new Date(), meses - 1 - i));
      const clave = format(mes, "yyyy-MM");
      const fila: Record<string, number | string> = {
        clave,
        etiqueta: format(mes, "MMM yy", { locale: es }),
        mesLargo: format(mes, "MMMM yyyy", { locale: es }),
        total: 0,
      };
      COLORES_DE_COMERCIAL.forEach((c) => { fila[c.valor] = 0; });
      cajones.set(clave, fila);
    }

    const acumulado: Record<string, number> = {};
    COLORES_DE_COMERCIAL.forEach((c) => { acumulado[c.valor] = 0; });
    let montoSinAsignar = 0;
    let contadorSinAsignar = 0;

    projects.forEach((p) => {
      if (p.isDeleted) return;
      const fecha = aFecha(p.fechaEjecucionInicio);
      if (!fecha || !isAfter(fecha, subMonths(desde, 1))) return;

      const monto = Number(p.ingresoTotal) || 0;
      // La atribucion sale del color de la fila. El rojo es solo una marca:
      // no pertenece a ningun comercial y cuenta como sin asignar.
      const color = buscarColor(p.color);
      const comercial = color && color.comercial ? color : null;

      if (!comercial) {
        montoSinAsignar += monto;
        contadorSinAsignar += 1;
        return;
      }

      const clave = format(startOfMonth(fecha), "yyyy-MM");
      const fila = cajones.get(clave);
      if (!fila) return;
      fila[comercial.valor] = (Number(fila[comercial.valor]) || 0) + monto;
      fila.total = (Number(fila.total) || 0) + monto;
      acumulado[comercial.valor] += monto;
    });

    return {
      datos: Array.from(cajones.values()),
      totales: acumulado,
      sinAsignar: montoSinAsignar,
      eventosSinAsignar: contadorSinAsignar,
    };
  }, [projects, meses]);

  const hayDatos = COLORES_DE_COMERCIAL.some((c) => (totales[c.valor] || 0) > 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Ventas por comercial</DialogTitle>
          <DialogDescription>
            Ingreso total de los eventos, por mes de ejecución, en los últimos {meses} meses.
          </DialogDescription>
        </DialogHeader>

        {/* Totales del periodo: el titular va antes que el detalle. */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {COLORES_DE_COMERCIAL.map((c) => (
            <div key={c.valor} className="rounded-lg border border-border p-3">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <span
                  className="h-2.5 w-2.5 rounded-full"
                  style={{ backgroundColor: oscuro ? c.graficaOscuro : c.graficaClaro }}
                />
                {c.nombre}
              </div>
              <div className="mt-1 text-lg font-semibold tabular-nums">
                {pesos.format(totales[c.valor] || 0)}
              </div>
            </div>
          ))}
          <div className="rounded-lg border border-dashed border-border p-3">
            <div className="text-xs text-muted-foreground">Sin asignar</div>
            <div className="mt-1 text-lg font-semibold tabular-nums text-muted-foreground">
              {pesos.format(sinAsignar)}
            </div>
            <div className="text-[11px] text-muted-foreground">
              {eventosSinAsignar} evento{eventosSinAsignar === 1 ? "" : "s"}
            </div>
          </div>
        </div>

        {hayDatos ? (
          <div className="h-[320px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={datos} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                <XAxis
                  dataKey="etiqueta"
                  tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                  tickLine={false}
                  axisLine={{ stroke: "hsl(var(--border))" }}
                />
                <YAxis
                  tickFormatter={millones}
                  tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                  tickLine={false}
                  axisLine={false}
                  width={56}
                />
                <Tooltip
                  cursor={{ fill: "hsl(var(--muted))", opacity: 0.3 }}
                  formatter={(valor: number, nombre: string) => [pesos.format(valor), nombre]}
                  labelFormatter={(etiqueta, carga) => {
                    const total = carga?.[0]?.payload?.total;
                    return total
                      ? `${etiqueta} · total ${pesos.format(Number(total))}`
                      : String(etiqueta);
                  }}
                  contentStyle={{
                    background: "hsl(var(--popover))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: 8,
                    fontSize: 12,
                    color: "hsl(var(--popover-foreground))",
                  }}
                />
                <Legend
                  wrapperStyle={{ fontSize: 12 }}
                  formatter={(valor) => (
                    <span style={{ color: "hsl(var(--foreground))" }}>{valor}</span>
                  )}
                />
                {COLORES_DE_COMERCIAL.map((c) => (
                  <Bar
                    key={c.valor}
                    dataKey={c.valor}
                    name={c.nombre}
                    fill={oscuro ? c.graficaOscuro : c.graficaClaro}
                    radius={[4, 4, 0, 0]}
                    maxBarSize={28}
                  />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="rounded-lg border border-dashed border-border p-8 text-center">
            <p className="text-sm font-medium">Todavía no hay ventas asignadas</p>
            <p className="mt-1 text-sm text-muted-foreground">
              En la columna Acciones de cada evento, usa el botón de la paleta
              para pintarlo de amarillo (Bayron) o azul (Abraham).
              La gráfica se llena sola.
            </p>
          </div>
        )}

        {/* Mes a mes en numeros. La grafica muestra la forma; la tabla, el dato
            exacto, que es lo que se copia a un informe. */}
        {hayDatos && (
          <div className="max-h-[220px] overflow-y-auto rounded-lg border border-border">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-muted/80 backdrop-blur">
                <tr className="text-left">
                  <th className="px-3 py-2 font-medium">Mes</th>
                  {COLORES_DE_COMERCIAL.map((c) => (
                    <th key={c.valor} className="px-3 py-2 text-right font-medium">
                      <span className="inline-flex items-center gap-1.5">
                        <span
                          className="h-2 w-2 rounded-full"
                          style={{ backgroundColor: oscuro ? c.graficaOscuro : c.graficaClaro }}
                        />
                        {c.nombre}
                      </span>
                    </th>
                  ))}
                  <th className="px-3 py-2 text-right font-medium">Total</th>
                </tr>
              </thead>
              <tbody>
                {datos
                  .filter((f) => Number(f.total) > 0)
                  .reverse()
                  .map((fila) => (
                    <tr key={String(fila.clave)} className="border-t border-border/60">
                      <td className="px-3 py-1.5 capitalize">{String(fila.mesLargo)}</td>
                      {COLORES_DE_COMERCIAL.map((c) => (
                        <td key={c.valor} className="px-3 py-1.5 text-right tabular-nums">
                          {Number(fila[c.valor]) > 0
                            ? pesos.format(Number(fila[c.valor]))
                            : <span className="text-muted-foreground">—</span>}
                        </td>
                      ))}
                      <td className="px-3 py-1.5 text-right font-medium tabular-nums">
                        {pesos.format(Number(fila.total))}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        )}

        {eventosSinAsignar > 0 && (
          <p className="text-xs text-muted-foreground">
            Hay {eventosSinAsignar} evento{eventosSinAsignar === 1 ? "" : "s"} sin
            color de comercial en este periodo, contando los marcados en rojo.
            No entran en las barras, para que la comparación no quede inflada.
          </p>
        )}
      </DialogContent>
    </Dialog>
  );
}
