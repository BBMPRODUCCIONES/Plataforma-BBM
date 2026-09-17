import { useMemo, useState, useEffect } from "react";
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
import { COLORES_DE_COMERCIAL, buscarColor, colorVisualDeEvento } from "@/lib/coloresProyecto";
import { montosDelEvento } from "@/lib/montosEvento";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { GraficaClientes } from "@/components/GraficaClientes";

interface GraficaVentasComercialProps {
  projects: Project[];
  /** Cuantos meses hacia atras mostrar. Se ignora si viene `mes`. */
  meses?: number;
  /** Un mes concreto en formato "yyyy-MM". Si viene, manda sobre `meses`. */
  mes?: string | null;
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
  projects,
  meses = 12,
  mes = null,
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

  const { datos, totales, ivaPorComercial, ivaDelPeriodo, sinDiscriminar, sinAsignar, eventosSinAsignar, eventosDelMes } = useMemo(() => {
    // Un cajon por mes, aunque el mes no tenga ventas: los huecos se ven.
    // Con `mes` hay un solo cajon y solo cuenta lo de ese mes.
    const cajones = new Map<string, Record<string, number | string>>();
    const nuevoCajon = (inicio: Date) => {
      const clave = format(inicio, "yyyy-MM");
      const fila: Record<string, number | string> = {
        clave,
        etiqueta: format(inicio, "MMM yy", { locale: es }),
        mesLargo: format(inicio, "MMMM yyyy", { locale: es }),
        total: 0,
      };
      COLORES_DE_COMERCIAL.forEach((c) => { fila[c.valor] = 0; });
      cajones.set(clave, fila);
    };

    if (mes) {
      nuevoCajon(parseISO(`${mes}-01T00:00:00`));
    } else {
      for (let i = 0; i < meses; i++) nuevoCajon(startOfMonth(subMonths(new Date(), meses - 1 - i)));
    }
    const desde = mes
      ? parseISO(`${mes}-01T00:00:00`)
      : startOfMonth(subMonths(new Date(), meses - 1));

    const acumulado: Record<string, number> = {};
    const acumuladoIva: Record<string, number> = {};
    COLORES_DE_COMERCIAL.forEach((c) => { acumulado[c.valor] = 0; acumuladoIva[c.valor] = 0; });
    let montoSinAsignar = 0;
    let contadorSinAsignar = 0;
    let ivaDelPeriodo = 0;
    // Eventos sin "ingreso bruto": no es que no tengan IVA, es que no se sabe
    // cuanto. Se cuentan para poder decirlo en pantalla.
    let sinDiscriminar = 0;

    let contadorDelMes = 0;

    projects.forEach((p) => {
      if (p.isDeleted) return;
      const fecha = aFecha(p.fechaEjecucionInicio);
      if (!fecha) return;
      const claveMes = format(startOfMonth(fecha), "yyyy-MM");
      // Fuera del periodo (o del mes elegido) el evento no cuenta para nada,
      // ni siquiera para "sin asignar": si no, el total no cuadra con la grafica.
      if (!cajones.has(claveMes)) return;
      contadorDelMes += 1;

      // La venta se mide sin IVA: el IVA se recauda y se gira, no es plata de
      // BBM. Sumandolo, un cliente exento y uno gravado con la misma venta real
      // se veian distintos.
      const { base: monto, iva, sinDiscriminar: sinIva } = montosDelEvento(p);
      if (sinIva) sinDiscriminar += 1;
      ivaDelPeriodo += iva;
      // La atribucion sale del color de la fila: el que se pone a mano, y si no
      // hay, el del correo que subio el evento. Asi un evento nuevo cuenta solo,
      // sin tener que acordarse de pintarlo. El rojo es solo una marca: no
      // pertenece a ningun comercial y cuenta como sin asignar.
      const visual = colorVisualDeEvento(p);
      const color = buscarColor(visual?.color);
      const comercial = color && color.comercial ? color : null;

      if (!comercial) {
        montoSinAsignar += monto;
        contadorSinAsignar += 1;
        return;
      }

      const fila = cajones.get(claveMes);
      if (!fila) return;
      fila[comercial.valor] = (Number(fila[comercial.valor]) || 0) + monto;
      fila.total = (Number(fila.total) || 0) + monto;
      acumulado[comercial.valor] += monto;
      acumuladoIva[comercial.valor] += iva;
    });

    return {
      datos: Array.from(cajones.values()),
      totales: acumulado,
      ivaPorComercial: acumuladoIva,
      ivaDelPeriodo,
      sinDiscriminar,
      sinAsignar: montoSinAsignar,
      eventosSinAsignar: contadorSinAsignar,
      eventosDelMes: contadorDelMes,
    };
  }, [projects, meses, mes]);

  const hayDatos = COLORES_DE_COMERCIAL.some((c) => (totales[c.valor] || 0) > 0);
  // La venta del periodo incluye lo que esta sin asignar: es plata que entro,
  // aunque todavia no se sepa de quien es.
  const ventaDelPeriodo =
    COLORES_DE_COMERCIAL.reduce((a, c) => a + (totales[c.valor] || 0), 0) + sinAsignar;
  // Un mes suelto no es una serie de tiempo: se compara comercial contra
  // comercial. El maximo da el ancho de las barras.
  const barrasMes = COLORES_DE_COMERCIAL.map((c) => ({
    valor: c.valor,
    nombre: c.nombre,
    monto: totales[c.valor] || 0,
    color: oscuro ? c.graficaOscuro : c.graficaClaro,
  })).sort((a, b) => b.monto - a.monto);
  const topMes = Math.max(1, ...barrasMes.map((b) => b.monto));
  const totalMes = barrasMes.reduce((a, b) => a + b.monto, 0);

  return (
    <div className="w-full min-w-0">
        <Tabs defaultValue="comercial" className="w-full min-w-0 space-y-3">
          <TabsList className="w-full">
            <TabsTrigger value="comercial" className="flex-1">Por comercial</TabsTrigger>
            <TabsTrigger value="cliente" className="flex-1">Por cliente</TabsTrigger>
          </TabsList>

          <TabsContent value="cliente" className="mt-3 w-full min-w-0">
            <GraficaClientes projects={projects} meses={meses} mes={mes} />
          </TabsContent>

          <TabsContent value="comercial" className="mt-3 w-full min-w-0 space-y-3">

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

        {/* Lo que se vendio, lo que se recaudo y lo que entra a la cuenta. Sin
            esta franja, "ventas" y "plata que llega" se confunden. */}
        {hayDatos && (
          <div className="flex flex-wrap items-baseline gap-x-6 gap-y-1 rounded-lg border border-border px-3 py-2 text-xs">
            <span>
              <span className="text-muted-foreground">Venta sin IVA </span>
              <span className="font-semibold tabular-nums">{pesos.format(ventaDelPeriodo)}</span>
            </span>
            <span>
              <span className="text-muted-foreground">IVA </span>
              <span className="font-semibold tabular-nums">{pesos.format(ivaDelPeriodo)}</span>
            </span>
            <span>
              <span className="text-muted-foreground">Facturado </span>
              <span className="font-semibold tabular-nums">{pesos.format(ventaDelPeriodo + ivaDelPeriodo)}</span>
            </span>
          </div>
        )}

        {sinDiscriminar > 0 && (
          <p className="text-[11px] text-muted-foreground">
            {sinDiscriminar} evento{sinDiscriminar === 1 ? "" : "s"} de este
            periodo no {sinDiscriminar === 1 ? "tiene" : "tienen"} ingreso bruto
            cargado, así que su IVA no se puede separar y su valor entero cuenta
            como venta. El IVA de arriba es el de los demás.
          </p>
        )}

        {mes ? (
          hayDatos ? (
            <div className="space-y-2 rounded-lg border border-border p-4">
              {barrasMes.map((b) => (
                <div key={b.valor} className="space-y-1">
                  <div className="flex items-baseline justify-between gap-3 text-sm">
                    <span className="flex items-center gap-1.5">
                      <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: b.color }} />
                      {b.nombre}
                    </span>
                    <span className="tabular-nums font-medium">
                      {pesos.format(b.monto)}
                      {totalMes > 0 && (
                        <span className="ml-2 text-xs font-normal text-muted-foreground">
                          {Math.round((b.monto / totalMes) * 100)}%
                        </span>
                      )}
                    </span>
                  </div>
                  <div className="h-2.5 w-full overflow-hidden rounded bg-muted">
                    <div
                      className="h-full rounded"
                      style={{ width: `${(b.monto / topMes) * 100}%`, backgroundColor: b.color }}
                    />
                  </div>
                </div>
              ))}
              <div className="flex justify-between border-t border-border/60 pt-2 text-sm">
                <span className="text-muted-foreground">Total del mes</span>
                <span className="font-semibold tabular-nums">{pesos.format(totalMes)}</span>
              </div>
            </div>
          ) : (
            <div className="rounded-lg border border-dashed border-border p-8 text-center">
              <p className="text-sm font-medium">Sin ventas asignadas en este mes</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {eventosDelMes > 0
                  ? `Hay ${eventosDelMes} evento${eventosDelMes === 1 ? "" : "s"} en el mes, pero ninguno tiene color de comercial.`
                  : "No hay eventos con fecha de ejecución en este mes."}
              </p>
            </div>
          )
        ) : hayDatos ? (
          <div className="h-[240px] w-full sm:h-[320px]">
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
                  }}
                  // Mismo criterio que en la torta: el texto con color de
                  // texto, la identidad la lleva el cuadrito de color.
                  itemStyle={{ color: "hsl(var(--popover-foreground))" }}
                  labelStyle={{ color: "hsl(var(--popover-foreground))", fontWeight: 600 }}
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
              Los eventos nuevos se atribuyen solos según el correo que los
              sube. Para los anteriores, usa el botón de la paleta en la columna
              Acciones y píntalos de amarillo (Bayron) o azul (Abraham).
            </p>
          </div>
        )}

        {/* Mes a mes en numeros. La grafica muestra la forma; la tabla, el dato
            exacto, que es lo que se copia a un informe. */}
        {hayDatos && !mes && (
          <div className="w-full min-w-0 max-h-[220px] overflow-auto rounded-lg border border-border">
            <table className="w-full min-w-[420px] text-sm">
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
                  <th className="px-3 py-2 text-right font-medium">Total sin IVA</th>
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
            color de comercial en {mes ? "este mes" : "este periodo"}, contando los marcados en rojo.
            No entran en las barras, para que la comparación no quede inflada.
          </p>
        )}
          </TabsContent>
        </Tabs>
    </div>
  );
}
