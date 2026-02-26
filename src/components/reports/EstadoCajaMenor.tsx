import { useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { UserCheck, Lock, RotateCcw } from "lucide-react";
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
}

const CHART_COLORS = ["#06b6d4", "#f59e0b", "#a855f7", "#3b82f6", "#ef4444", "#10b981"];

const fmt = (v: number) =>
  new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(v);

export default function EstadoCajaMenor({
  gastos, config, stats, isAdmin,
  editingBase, baseInput, onEditBase, onCancelEditBase, onBaseInputChange, onSaveBase,
  onRegisterResponsable, onCierre,
}: EstadoCajaMenorProps) {
  // Chart data: breakdown by category
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

  // Breakdown by tipo_centro
  const tipoCentroData = useMemo(() => {
    let eventos = 0, admin = 0;
    gastos
      .filter(g => g.estado === "Aprobado" || g.estado === "Legalizado" || g.estado === "Reembolsado")
      .forEach(g => {
        if (g.tipo_centro === "admin") admin += g.valor;
        else eventos += g.valor;
      });
    return [
      { name: "Eventos", value: eventos },
      { name: "Admin", value: admin },
    ].filter(d => d.value > 0);
  }, [gastos]);

  const cuadreDeCaja = stats.efectivoEnCaja;

  return (
    <div className="space-y-4">
      {/* Chart Row: Pie chart + Bar breakdown */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Pie Chart - Eventos vs Admin */}
        <Card className="border-border/50">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground font-medium mb-2 text-center uppercase tracking-wider">Distribución por Tipo</p>
            {tipoCentroData.length > 0 ? (
              <div className="flex items-center justify-center gap-6">
                <ResponsiveContainer width={140} height={140}>
                  <PieChart>
                    <Pie data={tipoCentroData} dataKey="value" cx="50%" cy="50%" outerRadius={60} innerRadius={30}>
                      {tipoCentroData.map((_, i) => (
                        <Cell key={i} fill={i === 0 ? "#06b6d4" : "#f59e0b"} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(val: number) => fmt(val)} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="space-y-2">
                  {tipoCentroData.map((d, i) => (
                    <div key={d.name} className="flex items-center gap-2 text-xs">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: i === 0 ? "#06b6d4" : "#f59e0b" }} />
                      <span className="text-muted-foreground">{d.name}</span>
                      <span className="font-semibold">{fmt(d.value)}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground text-center py-6">Sin datos</p>
            )}
          </CardContent>
        </Card>

        {/* Bar-style category breakdown */}
        <Card className="border-border/50">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground font-medium mb-3 text-center uppercase tracking-wider">Gasto por Categoría</p>
            {chartData.length > 0 ? (
              <div className="space-y-2">
                {chartData.map((cat, i) => {
                  const maxVal = chartData[0]?.value || 1;
                  const pct = (cat.value / maxVal) * 100;
                  return (
                    <div key={cat.name} className="space-y-0.5">
                      <div className="flex justify-between text-xs">
                        <span className="text-muted-foreground">{cat.name}</span>
                        <span className="font-semibold">{fmt(cat.value)}</span>
                      </div>
                      <div className="h-2 rounded-full bg-muted overflow-hidden">
                        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: CHART_COLORS[i % CHART_COLORS.length] }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground text-center py-6">Sin datos</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Estado de Caja Menor Panel */}
      <Card className="border-primary/30 bg-primary/5">
        <CardContent className="p-0">
          <div className="bg-primary/10 px-4 py-2.5 border-b border-primary/20">
            <h3 className="text-sm font-bold text-center uppercase tracking-wider">Estado de Caja Menor</h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-border/30">
            {/* Left: Persona Responsable + Cierre */}
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

              {/* Cierre de Caja */}
              <div>
                <p className="text-[11px] text-muted-foreground font-semibold uppercase mb-1.5">Cierre de Caja</p>
                <p className="text-xs mb-2">
                  Estado: <span className="font-semibold">{config?.estado_cierre || "Abierta"}</span>
                </p>
                {isAdmin && (
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" className="text-[11px] flex-1 h-8" onClick={() => onCierre("Legalizado")}>
                      <Lock className="h-3 w-3 mr-1" /> Legalizado
                    </Button>
                    <Button variant="outline" size="sm" className="text-[11px] flex-1 h-8" onClick={() => onCierre("Reembolsado")}>
                      <RotateCcw className="h-3 w-3 mr-1" /> Reembolsado
                    </Button>
                  </div>
                )}
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
        </CardContent>
      </Card>

      {/* Status counters row */}
      <div className="grid grid-cols-5 gap-2">
        {[
          { label: "Pendientes", count: gastos.filter(g => g.estado === "Pendiente").length, color: "text-yellow-500" },
          { label: "Aprobados", count: gastos.filter(g => g.estado === "Aprobado").length, color: "text-emerald-500" },
          { label: "No aprobados", count: gastos.filter(g => g.estado === "No aprobado").length, color: "text-destructive" },
          { label: "Legalizados", count: gastos.filter(g => g.estado === "Legalizado").length, color: "text-blue-500" },
          { label: "Reembolsados", count: gastos.filter(g => g.estado === "Reembolsado").length, color: "text-cyan-500" },
        ].map(s => (
          <Card key={s.label}>
            <CardContent className="p-2.5 text-center">
              <p className={`text-[10px] ${s.color}`}>{s.label}</p>
              <p className={`text-lg font-bold ${s.color}`}>{s.count}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
