import { useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { DollarSign, Clock, CheckCircle, XCircle, Utensils, Car, ShoppingBag, Sparkles, Wrench } from "lucide-react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { GastoMenor } from "@/hooks/useGastosMenores";

interface GastosMenoresKPIsProps {
  gastos: GastoMenor[];
}

const CATEGORY_COLORS: Record<string, string> = {
  Transporte: "#3b82f6",
  Alimentación: "#f97316",
  Papelería: "#a855f7",
  Aseo: "#06b6d4",
  Servicios: "#f59e0b",
};

const GastosMenoresKPIs = ({ gastos }: GastosMenoresKPIsProps) => {
  const stats = useMemo(() => {
    const total = gastos.filter(g => g.estado === "Aprobado").reduce((s, g) => s + g.valor, 0);
    const pendiente = gastos.filter(g => g.estado === "Pendiente");
    const aprobado = gastos.filter(g => g.estado === "Aprobado");
    const noAprobado = gastos.filter(g => g.estado === "No aprobado");

    const byCategoria: Record<string, number> = {};
    gastos.filter(g => g.estado === "Aprobado").forEach(g => {
      byCategoria[g.categoria] = (byCategoria[g.categoria] || 0) + g.valor;
    });

    return { total, pendiente, aprobado, noAprobado, byCategoria };
  }, [gastos]);

  const chartData = useMemo(() => {
    return Object.entries(stats.byCategoria)
      .filter(([, val]) => val > 0)
      .map(([cat, val]) => ({
        name: cat,
        value: val,
        color: CATEGORY_COLORS[cat] || "#6b7280",
      }));
  }, [stats.byCategoria]);

  const fmt = (v: number) =>
    new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(v);

  const catIcon: Record<string, React.ReactNode> = {
    Transporte: <Car className="h-3.5 w-3.5" />,
    Alimentación: <Utensils className="h-3.5 w-3.5" />,
    Papelería: <ShoppingBag className="h-3.5 w-3.5" />,
    Aseo: <Sparkles className="h-3.5 w-3.5" />,
    Servicios: <Wrench className="h-3.5 w-3.5" />,
  };

  if (gastos.length === 0) return null;

  return (
    <div className="space-y-3">
      {/* Main row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="p-3 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/20">
              <DollarSign className="h-4 w-4 text-primary" />
            </div>
            <div>
              <p className="text-[11px] text-muted-foreground">Total</p>
              <p className="text-sm font-bold">{fmt(stats.total)}</p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-yellow-500/20 bg-yellow-500/5">
          <CardContent className="p-3 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-yellow-500/20">
              <Clock className="h-4 w-4 text-yellow-500" />
            </div>
            <div>
              <p className="text-[11px] text-muted-foreground">Pendientes</p>
              <p className="text-sm font-bold text-yellow-500">{stats.pendiente.length}</p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-emerald-500/20 bg-emerald-500/5">
          <CardContent className="p-3 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-emerald-500/20">
              <CheckCircle className="h-4 w-4 text-emerald-500" />
            </div>
            <div>
              <p className="text-[11px] text-muted-foreground">Aprobados</p>
              <p className="text-sm font-bold text-emerald-500">{stats.aprobado.length}</p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-red-500/20 bg-red-500/5">
          <CardContent className="p-3 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-red-500/20">
              <XCircle className="h-4 w-4 text-red-500" />
            </div>
            <div>
              <p className="text-[11px] text-muted-foreground">No aprobados</p>
              <p className="text-sm font-bold text-red-500">{stats.noAprobado.length}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Donut charts by category */}
      {chartData.length > 0 && (
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground mb-3">Valor aprobado por categoría</p>
            <div className="flex flex-col md:flex-row items-center gap-4">
              {/* Donut Chart */}
              <div className="w-[180px] h-[180px] flex-shrink-0">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={chartData}
                      cx="50%"
                      cy="50%"
                      innerRadius={45}
                      outerRadius={75}
                      paddingAngle={3}
                      dataKey="value"
                      stroke="none"
                    >
                      {chartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(value: number) => fmt(value)}
                      contentStyle={{
                        backgroundColor: "hsl(var(--popover))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "8px",
                        color: "hsl(var(--popover-foreground))",
                        fontSize: "12px",
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              {/* Legend */}
              <div className="flex flex-col gap-2 flex-1">
                {chartData.map((entry) => (
                  <div key={entry.name} className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <div
                        className="w-3 h-3 rounded-full flex-shrink-0"
                        style={{ backgroundColor: entry.color }}
                      />
                      <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
                        {catIcon[entry.name] || <DollarSign className="h-3.5 w-3.5" />}
                        {entry.name}
                      </span>
                    </div>
                    <span className="text-sm font-medium">{fmt(entry.value)}</span>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default GastosMenoresKPIs;
