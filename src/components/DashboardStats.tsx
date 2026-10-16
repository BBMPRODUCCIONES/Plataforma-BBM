import { Project } from "@/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { CalendarDays, DollarSign, TrendingUp, Users } from "lucide-react";
import { format, startOfMonth, subMonths } from "date-fns";
import { es } from "date-fns/locale";
import { fechaDeVenta, ventaEnRango } from "@/lib/montosEvento";

interface DashboardStatsProps {
  projects: Project[];
  /**
   * El periodo que se esta mirando. Decide que ventas suman.
   *
   * Las filas que llegan en `projects` se filtran por montaje O ejecucion, para
   * que Operaciones no pierda de vista un montaje que empieza antes del
   * periodo. Pero la plata no puede seguir esa regla: un evento montado el 30
   * de octubre y ejecutado el 1 de noviembre pasaba el filtro de los dos meses
   * y se sumaba dos veces. La venta cuenta una sola vez, en el mes en que el
   * evento se ejecuta.
   */
  rango?: { start: Date; end: Date };
}

// Siete estados en una sola torta es mucho color. Estos se eligieron corriendo
// el validador de paletas, no a ojo: el peor par ahora se distingue con
// deuteranopia (el daltonismo mas comun, 1 de cada 12 hombres), donde antes
// "Terminado" y "Por Ejecutar" salian identicos, y "Facturado" y "En Progreso"
// costaban incluso con vision normal. La leyenda de al lado sigue diciendo el
// nombre y el numero de cada estado: el color acompana, no es el unico dato.
const COLORS = {
  por_planear: "hsl(48, 96%, 53%)",
  por_ejecutar: "hsl(217, 91%, 60%)",
  en_progreso: "hsl(142, 71%, 45%)",
  terminado: "hsl(258, 70%, 50%)",
  pendiente_facturar: "hsl(25, 95%, 53%)",
  facturado: "hsl(162, 94%, 24%)",
  no_se_factura: "hsl(213, 20%, 65%)",
};

export function DashboardStats({ projects, rango }: DashboardStatsProps) {
  // Solo los eventos que se EJECUTAN en el periodo cuentan como venta suya.
  const ventasDelPeriodo = projects.filter((p) => ventaEnRango(p, rango));
  const totalIngresos = ventasDelPeriodo.reduce((sum, p) => sum + (p.ingresoTotal || 0), 0);
  // Cuantas filas se ven pero no suman: son los que se montan en el periodo y
  // se ejecutan en otro. Decirlo evita que el total parezca estar mal.
  const soloMontaje = projects.length - ventasDelPeriodo.length;
  const totalEventos = projects.length;
  const eventosActivos = projects.filter((p) => p.estado === "en_progreso" || p.estado === "por_ejecutar").length;

  // Data for status pie chart
  const statusData = [
    { name: "Por Planear", value: projects.filter((p) => p.estado === "por_planear").length, color: COLORS.por_planear },
    { name: "Por Ejecutar", value: projects.filter((p) => p.estado === "por_ejecutar").length, color: COLORS.por_ejecutar },
    { name: "En Progreso", value: projects.filter((p) => p.estado === "en_progreso").length, color: COLORS.en_progreso },
    { name: "Terminado", value: projects.filter((p) => p.estado === "terminado").length, color: COLORS.terminado },
    { name: "Por Facturar", value: projects.filter((p) => p.estado === "pendiente_facturar").length, color: COLORS.pendiente_facturar },
    { name: "Facturado", value: projects.filter((p) => p.estado === "facturado").length, color: COLORS.facturado },
    { name: "No se Factura", value: projects.filter((p) => p.estado === "no_se_factura").length, color: COLORS.no_se_factura },
  ].filter((d) => d.value > 0);

  /**
   * Eventos por mes, de verdad.
   *
   * Hasta ahora esta grafica traia cuatro barras escritas a mano (Ene 2, Feb 3,
   * Mar 5, Abr 2) que no salian de ningun dato: se veian como reales y no lo
   * eran. Ahora cuenta los eventos por el mes en que se ejecutan, que es la
   * misma regla con la que se suma la plata.
   */
  const monthlyData = (() => {
    const cajones = new Map<string, { month: string; eventos: number }>();
    // Seis meses hacia atras desde hoy, aunque en alguno no haya nada: una
    // grafica que se salta los meses vacios hace creer que no hubo caida.
    for (let i = 5; i >= 0; i--) {
      const d = startOfMonth(subMonths(new Date(), i));
      cajones.set(format(d, "yyyy-MM"), {
        month: format(d, "LLL", { locale: es }),
        eventos: 0,
      });
    }
    for (const p of projects) {
      const f = fechaDeVenta(p);
      if (!f) continue;
      const cajon = cajones.get(format(startOfMonth(f), "yyyy-MM"));
      if (cajon) cajon.eventos += 1;
    }
    return [...cajones.values()];
  })();

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-card border-border">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Eventos</CardTitle>
            <CalendarDays className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalEventos}</div>
            <p className="text-xs text-muted-foreground mt-1">En el periodo actual</p>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Eventos Activos</CardTitle>
            <TrendingUp className="h-4 w-4 text-status-active" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-status-active">{eventosActivos}</div>
            <p className="text-xs text-muted-foreground mt-1">En ejecución o montaje</p>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Ingresos</CardTitle>
            <DollarSign className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${totalIngresos.toLocaleString("es-CO")}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Con IVA · eventos ejecutados en el periodo
              {soloMontaje > 0 && (
                <span className="block">
                  {soloMontaje} evento{soloMontaje === 1 ? "" : "s"} se ve{soloMontaje === 1 ? "" : "n"} acá por el montaje,
                  pero su venta cuenta en el mes en que se ejecuta.
                </span>
              )}
            </p>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Clientes</CardTitle>
            <Users className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{new Set(projects.map((p) => p.cliente)).size}</div>
            <p className="text-xs text-muted-foreground mt-1">Clientes únicos</p>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Bar Chart - Monthly Events */}
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="text-sm font-semibold">Eventos por mes de ejecución</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={monthlyData}>
                <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "8px",
                  }}
                />
                <Bar dataKey="eventos" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Pie Chart - Status Distribution */}
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="text-sm font-semibold">Distribución por Estado</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-center gap-8">
              <ResponsiveContainer width={150} height={150}>
                <PieChart>
                  <Pie
                    data={statusData}
                    cx="50%"
                    cy="50%"
                    innerRadius={40}
                    outerRadius={60}
                    paddingAngle={2}
                    dataKey="value"
                  >
                    {statusData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "8px",
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-2">
                {statusData.map((item) => (
                  <div key={item.name} className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }} />
                    <span className="text-xs text-muted-foreground">{item.name}</span>
                    <span className="text-xs font-medium">{item.value}</span>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
