import { useMemo } from "react";
import { Project } from "@/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import {
  AlertTriangle,
  CalendarClock,
  CalendarDays,
  DollarSign,
  FileWarning,
  Receipt,
  TrendingUp,
  UserX,
  Users,
  Ticket,
} from "lucide-react";
import {
  addDays,
  addMonths,
  differenceInCalendarDays,
  endOfDay,
  endOfMonth,
  format,
  isSameDay,
  startOfDay,
  startOfMonth,
  subMonths,
} from "date-fns";
import { es } from "date-fns/locale";
import { fechaDeVenta, montosDelEvento, sumarMontos, ventaEnRango } from "@/lib/montosEvento";
import { normalizarEstado } from "@/lib/estadosEvento";
import { lineasReales, marcadoSinTerceros, totalDeCostos } from "@/lib/costosEvento";
import { eventoVencidoSinCostos } from "@/lib/alertaCostos";
import { COLORES_DE_COMERCIAL, colorVisualDeEvento } from "@/lib/coloresProyecto";
import { normalizarFacturacion } from "@/lib/facturacionEvento";

/**
 * Tablero del Panel Directivo.
 *
 * Responde, en este orden, lo que un director mira primero:
 *  1. Cuanto se vendio en el periodo (sin IVA, que es la plata de BBM) y como
 *     va contra el periodo anterior.
 *  2. Cuanto queda de esa venta despues de pagarle a terceros, pero solo sobre
 *     los eventos que ya tienen costos cargados: con el resto el margen saldria
 *     inflado y pareceria real.
 *  3. Que se ejecuto y todavia no se ha cobrado. Rentable no es cobrado.
 *  4. Que hay que resolver ya y que viene esta semana.
 *
 * Dos listas de eventos:
 *  - `projects`: los del periodo, ya filtrados por comercial, productor y
 *    busqueda. Todo lo "del periodo" sale de aqui.
 *  - `todos`: los mismos filtros pero sin el de fechas. La grafica por mes y la
 *    comparacion con el periodo anterior necesitan meses que no estan en el
 *    periodo. Antes la grafica usaba solo el periodo, y por eso septiembre
 *    salia con 3 eventos cuando tuvo 51.
 */
interface DashboardStatsProps {
  projects: Project[];
  todos?: Project[];
  rango?: { start: Date; end: Date };
}

/** Por debajo de esto, la linea de costo es un relleno y no un gasto real. */
const COSTO_MINIMO_REAL = 1000;

const pesos = (n: number) => `$${Math.round(n).toLocaleString("es-CO")}`;

/** $164,4 M — para listas y ejes, donde el numero completo no cabe. */
const pesosCortos = (n: number) => {
  if (Math.abs(n) >= 1_000_000) {
    return `$${(n / 1_000_000).toLocaleString("es-CO", { maximumFractionDigits: 1 })} M`;
  }
  if (Math.abs(n) >= 1_000) return `$${Math.round(n / 1_000).toLocaleString("es-CO")} mil`;
  return pesos(n);
};

const aFecha = (valor?: string | null): Date | null => {
  if (!valor) return null;
  const d = new Date(valor.length > 10 ? valor : `${valor}T00:00:00`);
  return isNaN(d.getTime()) ? null : d;
};

/** Ultimo dia del evento: desmontaje si hay, si no el fin de la ejecucion. */
const finDelEvento = (p: Project) =>
  aFecha(p.fechaDesmontajeFin) ?? aFecha(p.fechaEjecucionFin) ?? aFecha(p.fechaEjecucionInicio);

/** Primer dia del evento: el montaje si hay, si no la ejecucion. */
const inicioDelEvento = (p: Project) =>
  aFecha(p.fechaMontajeInicio) ?? aFecha(p.fechaEjecucionInicio);

/** Mismo cliente aunque cambien mayusculas, tildes o espacios. */
function claveCliente(nombre?: string | null): string {
  return (nombre || "sin cliente")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function comercialDe(p: Project): string | null {
  const visual = colorVisualDeEvento(p);
  if (!visual) return null;
  return (
    COLORES_DE_COMERCIAL.find((c) => c.valor.toLowerCase() === visual.color.toLowerCase())
      ?.comercial ?? null
  );
}

/**
 * El periodo anterior al que se esta mirando, del mismo largo.
 * Si se mira un mes completo, es el mes anterior completo (no 30 dias atras).
 */
function periodoAnterior(r: { start: Date; end: Date }) {
  const esMesCompleto =
    isSameDay(r.start, startOfMonth(r.start)) && isSameDay(r.end, endOfMonth(r.start));
  if (esMesCompleto) {
    const ant = subMonths(r.start, 1);
    return { start: startOfMonth(ant), end: endOfMonth(ant) };
  }
  const dias = differenceInCalendarDays(r.end, r.start) + 1;
  return { start: startOfDay(addDays(r.start, -dias)), end: endOfDay(addDays(r.end, -dias)) };
}

export function DashboardStats({ projects, todos, rango }: DashboardStatsProps) {
  const universo = useMemo(
    () => (todos ?? projects).filter((p) => !p.isDeleted),
    [todos, projects]
  );
  const hoy = new Date();
  const inicioHoy = startOfDay(hoy);

  // ---- Lo del periodo ------------------------------------------------------
  const delPeriodo = useMemo(
    () => projects.filter((p) => !p.isDeleted && ventaEnRango(p, rango)),
    [projects, rango]
  );
  const ventas = sumarMontos(delPeriodo);

  // ---- Ventas REALES: solo con la factura subida ---------------------------------
  // Cuenta el subtotal de la factura (sin IVA) en el dia en que se facturo, no
  // lo cotizado ni el dia de ejecucion. Un numero de factura escrito sin el PDF
  // no cuenta: asi se decidio para que la cifra sea verificable.
  const fechaFactura = (p: Project) => aFecha(p.factura?.fecha ?? null);
  const esFacturaReal = (p: Project) => Boolean(p.factura?.archivo) && (p.factura?.subtotal ?? 0) > 0;
  const realesDelPeriodo = useMemo(
    () =>
      universo.filter((p) => {
        if (!esFacturaReal(p)) return false;
        const f = fechaFactura(p);
        if (!f) return false;
        return !rango || (f >= rango.start && f <= endOfDay(rango.end));
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [universo, rango]
  );
  const ventasReales = realesDelPeriodo.reduce((s, p) => s + (p.factura?.subtotal || 0), 0);
  const ivaReal = realesDelPeriodo.reduce((s, p) => s + (p.factura?.iva || 0), 0);

  const periodoPrevio = useMemo(() => {
    if (!rango) return null;
    const r = periodoAnterior(rango);
    const eventos = universo.filter((p) => ventaEnRango(p, r));
    const base = sumarMontos(eventos).base;
    const conVenta = eventos.filter((p) => montosDelEvento(p).base > 0).length;
    return {
      base,
      ticket: conVenta > 0 ? base / conVenta : null,
      clientes: new Set(eventos.map((p) => claveCliente(p.cliente))).size,
    };
  }, [universo, rango]);
  const anterior = periodoPrevio?.base ?? null;
  const variacion =
    anterior && anterior > 0 ? ((ventas.base - anterior) / anterior) * 100 : null;

  // ---- Ticket promedio y clientes ------------------------------------------------
  // El ticket se saca solo con eventos que tienen valor: uno en $0 (prestamo,
  // cortesia, o sin cotizar todavia) bajaria el promedio sin ser una venta.
  const eventosConVenta = delPeriodo.filter((p) => montosDelEvento(p).base > 0);
  const ticket = eventosConVenta.length > 0 ? ventas.base / eventosConVenta.length : null;
  const variacionTicket =
    ticket !== null && periodoPrevio?.ticket
      ? ((ticket - periodoPrevio.ticket) / periodoPrevio.ticket) * 100
      : null;

  const clientesDelPeriodo = new Set(delPeriodo.map((p) => claveCliente(p.cliente)));
  // Nuevo = su primer evento de toda la historia cae en este periodo.
  const clientesNuevos = useMemo(() => {
    if (!rango) return 0;
    const primero = new Map<string, Date>();
    for (const p of universo) {
      const f = fechaDeVenta(p);
      if (!f) continue;
      const k = claveCliente(p.cliente);
      const prev = primero.get(k);
      if (!prev || f < prev) primero.set(k, f);
    }
    let n = 0;
    for (const k of clientesDelPeriodo) {
      const f = primero.get(k);
      if (f && f >= rango.start && f <= rango.end) n += 1;
    }
    return n;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [universo, rango, delPeriodo]);
  const ventaPorCliente =
    clientesDelPeriodo.size > 0 ? ventas.base / clientesDelPeriodo.size : null;

  // Ejecutado = ya arranco la ejecucion. Es lo que se puede exigir en costos y
  // en cobro; lo que viene todavia no.
  const ejecutados = delPeriodo.filter((p) => {
    const f = fechaDeVenta(p);
    return f !== null && f <= hoy;
  });
  const porRealizar = delPeriodo.length - ejecutados.length;
  const enCursoHoy = universo.filter((p) => {
    const a = inicioDelEvento(p);
    const b = finDelEvento(p);
    return a && b && a <= hoy && endOfDay(b) >= inicioHoy;
  }).length;

  // ---- Margen: solo con costos cargados --------------------------------------
  // Hay eventos con lineas de $1 que se pusieron para apagar la alerta roja.
  // Contarlos como "con costos" dejaria un margen de casi 100% que no existe,
  // asi que solo cuentan los que suman de verdad o los marcados "sin terceros".
  const conCostos = ejecutados.filter(
    (p) => marcadoSinTerceros(p.costos) || totalDeCostos(p.costos) >= COSTO_MINIMO_REAL
  );
  const costosSimbolicos = delPeriodo.filter(
    (p) =>
      !marcadoSinTerceros(p.costos) &&
      lineasReales(p.costos).length > 0 &&
      totalDeCostos(p.costos) < COSTO_MINIMO_REAL
  ).length;
  const ventaConCostos = conCostos.reduce((s, p) => s + montosDelEvento(p).base, 0);
  const costosTerceros = conCostos.reduce((s, p) => s + totalDeCostos(p.costos), 0);
  const utilidad = ventaConCostos - costosTerceros;
  const margen = ventaConCostos > 0 ? (utilidad / ventaConCostos) * 100 : null;

  // ---- Cobro ---------------------------------------------------------------
  // Si la columna de facturacion ya existe en la base, manda ella. Mientras no,
  // el unico dato es el numero de factura.
  const hayColumnaFacturacion = universo.some((p) => p.estadoFacturacion !== undefined);
  const sinCobrar = ejecutados.filter((p) => {
    if (hayColumnaFacturacion) {
      const f = normalizarFacturacion(p.estadoFacturacion);
      return f === "por_facturar" || f === "sin_definir";
    }
    return !p.numFactura || p.numFactura.trim() === "";
  });
  const montoSinCobrar = sinCobrar.reduce((s, p) => s + montosDelEvento(p).total, 0);

  // ---- Pendientes ------------------------------------------------------------
  const pendientes = [
    {
      icono: AlertTriangle,
      texto: "Ejecutados sin costos cargados",
      n: delPeriodo.filter((p) => eventoVencidoSinCostos(p, hoy)).length,
      critico: true,
    },
    {
      icono: AlertTriangle,
      texto: "Costos simbólicos (menos de $1.000)",
      n: costosSimbolicos,
      critico: true,
    },
    {
      icono: Receipt,
      texto: hayColumnaFacturacion ? "Ejecutados por facturar" : "Ejecutados sin # de factura",
      n: sinCobrar.length,
      critico: false,
    },
    {
      icono: FileWarning,
      texto: "Ejecutados sin factura subida (no cuentan como venta real)",
      n: ejecutados.filter((p) => !p.factura?.archivo).length,
      critico: false,
    },
    {
      icono: UserX,
      texto: "Sin productor asignado",
      n: delPeriodo.filter((p) => !p.productor || !p.productor.trim()).length,
      critico: false,
    },
    {
      icono: CalendarDays,
      texto: "Fechas inconsistentes (fin antes del inicio)",
      n: delPeriodo.filter((p) => {
        const ei = aFecha(p.fechaEjecucionInicio);
        const ef = aFecha(p.fechaEjecucionFin);
        const mi = aFecha(p.fechaMontajeInicio);
        return (ei && ef && ef < ei) || (mi && ei && mi > ei);
      }).length,
      critico: false,
    },
    {
      icono: FileWarning,
      texto: "Sin ingreso bruto (IVA sin separar)",
      n: ventas.sinDiscriminar,
      critico: false,
    },
  ];

  // ---- Proximos 7 dias -------------------------------------------------------
  const proximos = useMemo(() => {
    const limite = endOfDay(addDays(hoy, 7));
    return universo
      .map((p) => ({ p, inicio: inicioDelEvento(p), fin: finDelEvento(p) }))
      .filter(({ inicio, fin }) => inicio && fin && inicio <= limite && endOfDay(fin) >= inicioHoy)
      .sort((a, b) => a.inicio!.getTime() - b.inicio!.getTime());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [universo]);

  // ---- Ventas por mes: 6 atras y 2 adelante ------------------------------------
  const porMes = useMemo(() => {
    const mesActual = format(hoy, "yyyy-MM");
    const cajones = new Map<
      string,
      { clave: string; mes: string; venta: number; real: number; eventos: number; facturas: number; futuro: boolean }
    >();
    for (let i = -5; i <= 2; i++) {
      const d = startOfMonth(addMonths(hoy, i));
      const clave = format(d, "yyyy-MM");
      cajones.set(clave, {
        clave,
        mes: format(d, "LLL yy", { locale: es }),
        venta: 0,
        real: 0,
        eventos: 0,
        facturas: 0,
        futuro: clave > mesActual,
      });
    }
    for (const p of universo) {
      const f = fechaDeVenta(p);
      if (!f) continue;
      const c = cajones.get(format(f, "yyyy-MM"));
      if (!c) continue;
      c.venta += montosDelEvento(p).base;
      c.eventos += 1;
    }
    for (const p of universo) {
      if (!esFacturaReal(p)) continue;
      const f = fechaFactura(p);
      if (!f) continue;
      const c = cajones.get(format(f, "yyyy-MM"));
      if (!c) continue;
      c.real += p.factura?.subtotal || 0;
      c.facturas += 1;
    }
    return [...cajones.values()];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [universo]);

  // ---- Clientes y comerciales del periodo --------------------------------------
  const topClientes = useMemo(() => {
    const m = new Map<string, { venta: number; n: number }>();
    for (const p of delPeriodo) {
      const k = (p.cliente || "Sin cliente").trim();
      const v = m.get(k) ?? { venta: 0, n: 0 };
      v.venta += montosDelEvento(p).base;
      v.n += 1;
      m.set(k, v);
    }
    return [...m.entries()].sort((a, b) => b[1].venta - a[1].venta);
  }, [delPeriodo]);

  const porComercial = useMemo(() => {
    const filas = [
      ...COLORES_DE_COMERCIAL.map((c) => ({
        nombre: c.comercial as string,
        color: c.graficaOscuro,
        venta: 0,
        n: 0,
      })),
      { nombre: "Sin comercial", color: "hsl(var(--muted-foreground))", venta: 0, n: 0 },
    ];
    for (const p of delPeriodo) {
      const c = comercialDe(p);
      const fila = filas.find((f) => f.nombre === c) ?? filas[filas.length - 1];
      fila.venta += montosDelEvento(p).base;
      fila.n += 1;
    }
    return filas.filter((f) => f.n > 0);
  }, [delPeriodo]);

  const maxCliente = topClientes[0]?.[1].venta || 1;

  return (
    <div className="space-y-4">
      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <Kpi titulo="Ventas estimadas" icono={DollarSign}>
          <div className="text-2xl font-bold">{pesos(ventas.base)}</div>
          <p className="text-xs text-muted-foreground mt-1">
            Cotizado sin IVA, por fecha de ejecución · {pesos(ventas.total)} con IVA
          </p>
          {variacion !== null && (
            <p
              className={`text-xs mt-1 font-medium ${
                variacion >= 0 ? "text-emerald-400" : "text-red-400"
              }`}
            >
              {variacion >= 0 ? "▲" : "▼"} {Math.abs(variacion).toFixed(0)}% vs periodo anterior (
              {pesosCortos(anterior ?? 0)})
            </p>
          )}
        </Kpi>

        <Kpi titulo="Ventas reales (facturadas)" icono={Receipt}>
          <div className="text-2xl font-bold text-emerald-400">{pesos(ventasReales)}</div>
          <p className="text-xs text-muted-foreground mt-1">
            Subtotal de {realesDelPeriodo.length} factura{realesDelPeriodo.length === 1 ? "" : "s"} subida
            {realesDelPeriodo.length === 1 ? "" : "s"}, por fecha de factura · IVA {pesos(ivaReal)}
          </p>
          {ventas.base > 0 && (
            <p className="text-xs mt-1 text-muted-foreground">
              {((ventasReales / ventas.base) * 100).toFixed(0)}% de lo estimado del periodo
            </p>
          )}
        </Kpi>

        <Kpi titulo="Utilidad bruta estimada" icono={TrendingUp}>
          {margen === null ? (
            <>
              <div className="text-2xl font-bold text-muted-foreground">—</div>
              <p className="text-xs text-muted-foreground mt-1">
                Ningún evento ejecutado tiene costos cargados todavía
              </p>
            </>
          ) : (
            <>
              <div className="text-2xl font-bold">
                {pesos(utilidad)}{" "}
                <span className="text-base font-semibold text-muted-foreground">
                  {margen.toFixed(0)}%
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Venta sin IVA − costos de terceros
              </p>
              <p
                className={`text-xs mt-1 ${
                  conCostos.length < ejecutados.length ? "text-amber-400" : "text-muted-foreground"
                }`}
              >
                {conCostos.length < ejecutados.length
                  ? `Solo ${conCostos.length} de ${ejecutados.length} ejecutados tienen costos: falta cargar el resto para que sea real`
                  : `Todos los ${ejecutados.length} ejecutados tienen costos cargados`}
              </p>
            </>
          )}
        </Kpi>

        <Kpi titulo={hayColumnaFacturacion ? "Por facturar" : "Ejecutado sin factura"} icono={Receipt}>
          <div className="text-2xl font-bold">{pesos(montoSinCobrar)}</div>
          <p className="text-xs text-muted-foreground mt-1">
            Con IVA · {sinCobrar.length} evento{sinCobrar.length === 1 ? "" : "s"} ya ejecutado
            {sinCobrar.length === 1 ? "" : "s"}
          </p>
          <p className="text-xs text-muted-foreground">Vendido no es cobrado</p>
        </Kpi>

        <Kpi titulo="Eventos del periodo" icono={CalendarDays}>
          <div className="text-2xl font-bold">{delPeriodo.length}</div>
          <p className="text-xs text-muted-foreground mt-1">
            {ejecutados.length} ejecutados · {porRealizar} por realizar
          </p>
          <p className="text-xs text-muted-foreground">
            {enCursoHoy} en curso hoy
          </p>
        </Kpi>

        <Kpi titulo="Ticket promedio" icono={Ticket}>
          <div className="text-2xl font-bold">{ticket === null ? "—" : pesos(ticket)}</div>
          <p className="text-xs text-muted-foreground mt-1">
            Venta sin IVA por evento · {eventosConVenta.length} eventos con valor
          </p>
          {variacionTicket !== null && (
            <p
              className={`text-xs mt-1 font-medium ${
                variacionTicket >= 0 ? "text-emerald-400" : "text-red-400"
              }`}
            >
              {variacionTicket >= 0 ? "▲" : "▼"} {Math.abs(variacionTicket).toFixed(0)}% vs periodo
              anterior ({pesosCortos(periodoPrevio?.ticket ?? 0)})
            </p>
          )}
        </Kpi>

        <Kpi titulo="Clientes" icono={Users}>
          <div className="text-2xl font-bold">
            {clientesDelPeriodo.size}{" "}
            <span className="text-base font-semibold text-muted-foreground">
              {clientesNuevos} nuevo{clientesNuevos === 1 ? "" : "s"}
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            {clientesDelPeriodo.size - clientesNuevos} recurrentes
            {periodoPrevio ? ` · ${periodoPrevio.clientes} en el periodo anterior` : ""}
          </p>
          {ventaPorCliente !== null && (
            <p className="text-xs text-muted-foreground">
              {pesosCortos(ventaPorCliente)} de venta promedio por cliente
            </p>
          )}
        </Kpi>
      </div>

      {/* Tendencia + pendientes */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="bg-card border-border lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Ventas estimadas vs. reales, sin IVA</CardTitle>
            <p className="text-xs text-muted-foreground">
              <span className="inline-block h-2 w-2 rounded-full bg-primary mr-1" />Estimada: cotizado, por mes de ejecución ·{" "}
              <span className="inline-block h-2 w-2 rounded-full bg-emerald-500 mr-1" />Real: facturas subidas, por mes de factura
            </p>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={porMes} margin={{ left: 8, right: 8 }}>
                <XAxis
                  dataKey="mes"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  width={60}
                  tickFormatter={(v) => pesosCortos(v)}
                  tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
                />
                <Tooltip
                  cursor={{ fill: "hsl(var(--muted) / 0.3)" }}
                  contentStyle={{
                    backgroundColor: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "8px",
                  }}
                  labelStyle={{ color: "hsl(var(--foreground))" }}
                  formatter={(v: number, n, item) =>
                    n === "real"
                      ? [`${pesos(v)} · ${item.payload.facturas} facturas`, "Real (facturado)"]
                      : [`${pesos(v)} · ${item.payload.eventos} eventos`, "Estimada (cotizado)"]
                  }
                />
                <Bar dataKey="venta" radius={[4, 4, 0, 0]}>
                  {porMes.map((m) => (
                    <Cell
                      key={m.clave}
                      fill="hsl(var(--primary))"
                      fillOpacity={m.futuro ? 0.4 : 1}
                    />
                  ))}
                </Bar>
                <Bar dataKey="real" fill="#10b981" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Pendientes del periodo</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            {pendientes.map(({ icono: Icono, texto, n, critico }) => (
              <div
                key={texto}
                className="flex items-center justify-between gap-2 rounded-md px-2 py-2 hover:bg-muted/40"
              >
                <span className="flex items-center gap-2 text-sm">
                  <Icono
                    className={`h-4 w-4 shrink-0 ${
                      n > 0 && critico ? "text-red-400" : n > 0 ? "text-amber-400" : "text-muted-foreground"
                    }`}
                  />
                  <span className={n === 0 ? "text-muted-foreground" : ""}>{texto}</span>
                </span>
                <span
                  className={`text-sm font-semibold tabular-nums ${
                    n > 0 && critico ? "text-red-400" : n > 0 ? "text-foreground" : "text-muted-foreground"
                  }`}
                >
                  {n === 0 ? "✓" : n}
                </span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* Proximos, clientes, comerciales */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="bg-card border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <CalendarClock className="h-4 w-4 text-primary" /> Próximos 7 días
            </CardTitle>
          </CardHeader>
          <CardContent>
            {proximos.length === 0 ? (
              <p className="text-sm text-muted-foreground">No hay montajes ni eventos esta semana.</p>
            ) : (
              <ul className="space-y-2">
                {proximos.slice(0, 8).map(({ p, inicio }) => {
                  const enCurso = inicio! <= hoy;
                  return (
                    <li key={p.id} className="flex gap-3 text-sm">
                      <span className="w-14 shrink-0 text-xs text-muted-foreground pt-0.5">
                        {enCurso ? "En curso" : format(inicio!, "EEE d", { locale: es })}
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate font-medium">{p.evento || "Sin nombre"}</span>
                        <span className="block truncate text-xs text-muted-foreground">
                          {p.cliente}
                          {" · "}
                          {p.productor?.trim() ? (
                            p.productor
                          ) : (
                            <span className="text-amber-400">sin productor</span>
                          )}
                        </span>
                      </span>
                    </li>
                  );
                })}
                {proximos.length > 8 && (
                  <li className="text-xs text-muted-foreground">+{proximos.length - 8} más</li>
                )}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Clientes que más compran</CardTitle>
            <p className="text-xs text-muted-foreground">Venta sin IVA en el periodo</p>
          </CardHeader>
          <CardContent>
            {topClientes.length === 0 ? (
              <p className="text-sm text-muted-foreground">Sin ventas en el periodo.</p>
            ) : (
              <ul className="space-y-2.5">
                {topClientes.slice(0, 6).map(([cliente, v]) => (
                  <li key={cliente}>
                    <div className="flex justify-between gap-2 text-xs">
                      <span className="truncate">{cliente}</span>
                      <span className="shrink-0 tabular-nums text-muted-foreground">
                        {pesosCortos(v.venta)} · {v.n}
                      </span>
                    </div>
                    <div className="mt-1 h-1.5 rounded-full bg-muted">
                      <div
                        className="h-1.5 rounded-full bg-primary"
                        style={{ width: `${Math.max(2, (v.venta / maxCliente) * 100)}%` }}
                      />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Ventas por comercial</CardTitle>
            <p className="text-xs text-muted-foreground">Por el color del evento · sin IVA</p>
          </CardHeader>
          <CardContent>
            {porComercial.length === 0 ? (
              <p className="text-sm text-muted-foreground">Sin ventas en el periodo.</p>
            ) : (
              <ul className="space-y-3">
                {porComercial.map((c) => {
                  const pct = ventas.base > 0 ? (c.venta / ventas.base) * 100 : 0;
                  return (
                    <li key={c.nombre}>
                      <div className="flex justify-between gap-2 text-sm">
                        <span className="flex items-center gap-2">
                          <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: c.color }} />
                          {c.nombre}
                        </span>
                        <span className="tabular-nums">{pesosCortos(c.venta)}</span>
                      </div>
                      <div className="mt-1 h-1.5 rounded-full bg-muted">
                        <div
                          className="h-1.5 rounded-full"
                          style={{ width: `${Math.max(2, pct)}%`, backgroundColor: c.color }}
                        />
                      </div>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {c.n} evento{c.n === 1 ? "" : "s"} · {pct.toFixed(0)}% de la venta
                      </p>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Kpi({
  titulo,
  icono: Icono,
  children,
}: {
  titulo: string;
  icono: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
}) {
  return (
    <Card className="bg-card border-border">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{titulo}</CardTitle>
        <Icono className="h-4 w-4 text-primary" />
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}
