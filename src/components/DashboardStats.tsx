import { Project } from "@/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { CalendarDays, DollarSign, TrendingUp, Users } from "lucide-react";

interface DashboardStatsProps {
  projects: Project[];
}

const COLORS = {
  por_planear: "hsl(48, 96%, 53%)",
  por_ejecutar: "hsl(217, 91%, 60%)",
  en_progreso: "hsl(142, 71%, 45%)",
  terminado: "hsl(271, 91%, 65%)",
  facturado: "hsl(160, 84%, 39%)",
};

export function DashboardStats({ projects }: DashboardStatsProps) {
  const totalIngresos = projects.reduce((sum, p) => sum + (p.ingresoTotal || 0), 0);
  const totalEventos = projects.length;
  const eventosActivos = projects.filter((p) => p.estado === "en_progreso" || p.estado === "por_ejecutar").length;

  // Data for status pie chart
  const statusData = [
    { name: "Por Planear", value: projects.filter((p) => p.estado === "por_planear").length, color: COLORS.por_planear },
    { name: "Por Ejecutar", value: projects.filter((p) => p.estado === "por_ejecutar").length, color: COLORS.por_ejecutar },
    { name: "En Progreso", value: projects.filter((p) => p.estado === "en_progreso").length, color: COLORS.en_progreso },
    { name: "Terminado", value: projects.filter((p) => p.estado === "terminado").length, color: COLORS.terminado },
    { name: "Facturado", value: projects.filter((p) => p.estado === "facturado").length, color: COLORS.facturado },
  ].filter((d) => d.value > 0);

  // Data for monthly bar chart (mock data based on projects)
  const monthlyData = [
    { month: "Ene", eventos: 2, ingresos: 45000 },
    { month: "Feb", eventos: 3, ingresos: 68000 },
    { month: "Mar", eventos: 5, ingresos: 125000 },
    { month: "Abr", eventos: 2, ingresos: 35000 },
  ];

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
            <div className="text-2xl font-bold">${totalIngresos.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground mt-1">Suma de proyectos</p>
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
            <CardTitle className="text-sm font-semibold">Eventos por Mes</CardTitle>
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
