import { useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { GastoMenor } from "@/hooks/useGastosMenores";

interface CajaMenorChartsProps {
  gastos: GastoMenor[];
  base: number;
  snapshotStats?: {
    base_asignada: number;
    total_aprobados: number;
  } | null;
}

const CHART_COLORS = ["#06b6d4", "#f59e0b", "#a855f7", "#3b82f6", "#ef4444", "#10b981"];

const fmt = (v: number) =>
  new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(v);

export default function CajaMenorCharts({ gastos, base, snapshotStats }: CajaMenorChartsProps) {
  const chartData = useMemo(() => {
    if (snapshotStats) return []; // No category breakdown for snapshots
    const byCategory = new Map<string, number>();
    gastos
      .filter(g => g.estado === "Aprobado" || g.estado === "Legalizado" || g.estado === "Reembolsado")
      .forEach(g => {
        byCategory.set(g.categoria, (byCategory.get(g.categoria) || 0) + g.valor);
      });
    return Array.from(byCategory.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [gastos, snapshotStats]);

  const totalAprobados = snapshotStats ? snapshotStats.total_aprobados : chartData.reduce((s, d) => s + d.value, 0);
  const effectiveBase = snapshotStats ? snapshotStats.base_asignada : base;
  const gastadoPct = effectiveBase > 0 ? Math.min((totalAprobados / effectiveBase) * 100, 100) : 0;
  const disponible = effectiveBase - totalAprobados;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <Card className="border-border/50">
        <CardContent className="p-4">
          <p className="text-xs text-muted-foreground font-medium mb-2 text-center uppercase tracking-wider">Distribución por Categoría</p>
          {chartData.length > 0 ? (
            <div className="flex items-center justify-center gap-6">
              <ResponsiveContainer width={160} height={160}>
                <PieChart>
                  <Pie data={chartData} dataKey="value" cx="50%" cy="50%" outerRadius={65} innerRadius={35}>
                    {chartData.map((_, i) => (
                      <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(val: number) => fmt(val)} />
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-2">
                {chartData.map((d, i) => (
                  <div key={d.name} className="flex items-center gap-2 text-xs">
                    <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: CHART_COLORS[i % CHART_COLORS.length] }} />
                    <span className="text-muted-foreground">{d.name}</span>
                    <span className="font-semibold">{fmt(d.value)}</span>
                  </div>
                ))}
                <div className="border-t border-border/30 pt-1 mt-1">
                  <span className="text-xs font-bold">Total: {fmt(totalAprobados)}</span>
                </div>
              </div>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground text-center py-6">Sin gastos aprobados</p>
          )}
        </CardContent>
      </Card>

      <Card className="border-border/50">
        <CardContent className="p-4 flex flex-col justify-center h-full">
          <p className="text-xs text-muted-foreground font-medium mb-4 text-center uppercase tracking-wider">Presupuesto Base</p>
          <div className="space-y-3">
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">Gastado</span>
              <span className="font-semibold">{fmt(totalAprobados)}</span>
            </div>
            <div className="h-4 rounded-full bg-muted overflow-hidden relative">
              <div
                className="h-full rounded-full transition-all"
                style={{
                  width: `${gastadoPct}%`,
                  backgroundColor: gastadoPct > 80 ? "hsl(var(--destructive))" : gastadoPct > 50 ? "#f59e0b" : "#06b6d4",
                }}
              />
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">Disponible</span>
              <span className={`font-bold ${disponible >= 0 ? "text-emerald-500" : "text-destructive"}`}>{fmt(disponible)}</span>
            </div>
            <p className="text-center text-[11px] text-muted-foreground">
              Base asignada: <span className="font-semibold">{fmt(base)}</span> — Usado: <span className="font-semibold">{gastadoPct.toFixed(1)}%</span>
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
