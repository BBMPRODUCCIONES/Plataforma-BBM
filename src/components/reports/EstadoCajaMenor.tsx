import { useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { UserCheck, Lock, RotateCcw, Plus } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { GastoMenor } from "@/hooks/useGastosMenores";
import { CajaMenorConfig } from "@/hooks/useCajaMenorConfig";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";

interface EstadoCajaMenorProps {
  gastos: GastoMenor[];
  config: CajaMenorConfig | null;
  stats: {
    base: number;
    totalAprobados: number;
    totalPendientes: number;
    efectivoEnCaja: number;
    reembolsado: number;
  };
  isAdmin: boolean;
  editingBase: boolean;
  baseInput: string;
  onEditBase: () => void;
  onCancelEditBase: () => void;
  onBaseInputChange: (val: string) => void;
  onSaveBase: () => void;
  onRegisterResponsable: () => void;
  onCierre: (estado: "Legalizado" | "Reembolsado") => void;
  onAgregarGasto: () => void;
}

const CHART_COLORS = ["#06b6d4", "#f59e0b", "#a855f7", "#3b82f6", "#ef4444", "#10b981"];

const fmt = (v: number) =>
  new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(v);

export default function EstadoCajaMenor({
  gastos, config, stats, isAdmin,
  editingBase, baseInput, onEditBase, onCancelEditBase, onBaseInputChange, onSaveBase,
  onRegisterResponsable, onCierre, onAgregarGasto,
}: EstadoCajaMenorProps) {
  // Chart data: approved expenses by category (for donut)
  const chartData = useMemo(() => {
    const byCategory = new Map<string, number>();
    gastos
      .filter(g => g.estado === "Aprobado" || g.estado === "Legalizado" || g.estado === "Reembolsado")
      .forEach(g => {
        byCategory.set(g.categoria, (byCategory.get(g.categoria) || 0) + g.valor);
      });
    return Array.from(byCategory.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [gastos]);

  const totalAprobados = useMemo(() => chartData.reduce((s, d) => s + d.value, 0), [chartData]);
  const base = stats.base;
  const gastadoPct = base > 0 ? Math.min((totalAprobados / base) * 100, 100) : 0;
  const disponible = base - totalAprobados;

  const cuadreDeCaja = stats.efectivoEnCaja;

  const chartsSection = (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {/* Donut Chart - Gastos aprobados por categoría */}
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

      {/* Budget progress bar */}
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

  return (
    <>
      {/* Charts section - rendered separately, outside the main card */}
      {chartsSection}

      {/* Estado de Caja Menor Panel - no wrapper Card, parent wraps this with the table */}
      <div>
          <div className="bg-primary/10 px-4 py-2.5 border-b border-primary/20 flex items-center justify-between">
            <h3 className="text-sm font-bold uppercase tracking-wider">Estado de Caja Menor</h3>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" className="text-[11px] h-7" onClick={() => onCierre("Legalizado")}>
                <Lock className="h-3 w-3 mr-1" /> Legalizado
              </Button>
              <Button variant="outline" size="sm" className="text-[11px] h-7" onClick={() => onCierre("Reembolsado")}>
                <RotateCcw className="h-3 w-3 mr-1" /> Reembolsado
              </Button>
              <Button size="sm" className="text-[11px] h-7" onClick={onAgregarGasto}>
                <Plus className="h-3 w-3 mr-1" /> Agregar Gasto
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-border/30">
            {/* Left: Persona Responsable + Cierre estado */}
            <div className="p-4 space-y-3">
              {/* Persona Responsable */}
              <div>
                <p className="text-[11px] text-muted-foreground font-semibold uppercase mb-1.5">Persona Responsable</p>
                {config?.responsable_nombre ? (
                  <div className="flex items-center gap-2">
                    <UserCheck className="h-4 w-4 text-emerald-500 shrink-0" />
                    <div>
                      <p className="text-sm font-medium">{config.responsable_nombre}</p>
                      {config.responsable_timestamp && (
                        <p className="text-[10px] text-muted-foreground">
                          {format(new Date(config.responsable_timestamp), "dd/MM/yyyy HH:mm", { locale: es })}
                        </p>
                      )}
                    </div>
                  </div>
                ) : (
                  <Button variant="outline" size="sm" onClick={onRegisterResponsable} className="w-full text-xs">
                    <UserCheck className="h-3.5 w-3.5 mr-1" /> Autologueo
                  </Button>
                )}
              </div>

              {/* Cierre de Caja estado */}
              <div>
                <p className="text-[11px] text-muted-foreground font-semibold uppercase mb-1.5">Cierre de Caja</p>
                <p className="text-xs">
                  Estado: <span className="font-semibold">{config?.estado_cierre || "Abierta"}</span>
                </p>
              </div>
            </div>

            {/* Center: Financial summary table */}
            <div className="p-4 md:col-span-2">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">Concepto</TableHead>
                    <TableHead className="text-xs text-right">Valor</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow>
                    <TableCell className="text-xs py-1.5 font-medium">Base asignada</TableCell>
                    <TableCell className="text-xs py-1.5 text-right font-mono">
                      {editingBase ? (
                        <div className="flex items-center gap-1 justify-end">
                          <Input type="number" value={baseInput} onChange={(e) => onBaseInputChange(e.target.value)} className="h-7 text-xs w-32 text-right" />
                          <Button size="sm" className="h-7 text-[10px] px-2" onClick={onSaveBase}>OK</Button>
                          <Button size="sm" variant="ghost" className="h-7 text-[10px] px-2" onClick={onCancelEditBase}>✕</Button>
                        </div>
                      ) : (
                        <span className="cursor-pointer hover:underline" onClick={isAdmin ? onEditBase : undefined}>
                          {fmt(stats.base)}
                        </span>
                      )}
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="text-xs py-1.5">Total gastos aprobados</TableCell>
                    <TableCell className="text-xs py-1.5 text-right font-mono text-emerald-500 font-semibold">{fmt(stats.totalAprobados)}</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="text-xs py-1.5">Total gastos pendientes</TableCell>
                    <TableCell className="text-xs py-1.5 text-right font-mono text-yellow-500">{fmt(stats.totalPendientes)}</TableCell>
                  </TableRow>
                  <TableRow className="border-t-2 border-border/50">
                    <TableCell className="text-xs py-1.5 font-semibold">Efectivo en caja</TableCell>
                    <TableCell className="text-xs py-1.5 text-right font-mono font-bold">{fmt(stats.efectivoEnCaja)}</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="text-xs py-1.5">Cuadre de caja</TableCell>
                    <TableCell className={`text-xs py-1.5 text-right font-mono font-bold ${cuadreDeCaja >= 0 ? "text-emerald-500" : "text-destructive"}`}>
                      {cuadreDeCaja >= 0 ? "" : "- "}{fmt(Math.abs(cuadreDeCaja))}
                    </TableCell>
                  </TableRow>
                  <TableRow className="border-t-2 border-border/50">
                    <TableCell className="text-xs py-1.5 font-bold uppercase">Reembolsado</TableCell>
                    <TableCell className="text-xs py-1.5 text-right font-mono font-bold text-cyan-500">{fmt(stats.reembolsado)}</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          </div>
      </div>
    </>
  );
}
