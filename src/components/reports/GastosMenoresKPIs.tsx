import { useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { DollarSign, Clock, CheckCircle, XCircle, Wallet, ArrowDownCircle, FileCheck, RotateCcw } from "lucide-react";
import { GastoMenor } from "@/hooks/useGastosMenores";

interface GastosMenoresKPIsProps {
  gastos: GastoMenor[];
  baseAsignada?: number;
}

const GastosMenoresKPIs = ({ gastos, baseAsignada = 0 }: GastosMenoresKPIsProps) => {
  const stats = useMemo(() => {
    const totalAprobados = gastos
      .filter(g => g.estado === "Aprobado" || g.estado === "Legalizado" || g.estado === "Reembolsado")
      .reduce((s, g) => s + g.valor, 0);
    const totalPendientes = gastos
      .filter(g => g.estado === "Pendiente")
      .reduce((s, g) => s + g.valor, 0);
    const efectivoEnCaja = baseAsignada - totalAprobados;
    const reembolsado = gastos
      .filter(g => g.estado === "Reembolsado")
      .reduce((s, g) => s + g.valor, 0);

    const pendienteCount = gastos.filter(g => g.estado === "Pendiente").length;
    const aprobadoCount = gastos.filter(g => g.estado === "Aprobado").length;
    const noAprobadoCount = gastos.filter(g => g.estado === "No aprobado").length;
    const legalizadoCount = gastos.filter(g => g.estado === "Legalizado").length;
    const reembolsadoCount = gastos.filter(g => g.estado === "Reembolsado").length;

    return {
      totalAprobados, totalPendientes, efectivoEnCaja, reembolsado,
      pendienteCount, aprobadoCount, noAprobadoCount, legalizadoCount, reembolsadoCount,
      total: gastos.length,
    };
  }, [gastos, baseAsignada]);

  const fmt = (v: number) =>
    new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(v);

  return (
    <div className="space-y-3">
      {/* Financial KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {baseAsignada > 0 && (
          <Card className="border-primary/20 bg-primary/5">
            <CardContent className="p-3 flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/20">
                <Wallet className="h-4 w-4 text-primary" />
              </div>
              <div>
                <p className="text-[11px] text-muted-foreground">Base Asignada</p>
                <p className="text-sm font-bold">{fmt(baseAsignada)}</p>
              </div>
            </CardContent>
          </Card>
        )}

        <Card className="border-emerald-500/20 bg-emerald-500/5">
          <CardContent className="p-3 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-emerald-500/20">
              <CheckCircle className="h-4 w-4 text-emerald-500" />
            </div>
            <div>
              <p className="text-[11px] text-muted-foreground">Gastos Aprobados</p>
              <p className="text-sm font-bold text-emerald-500">{fmt(stats.totalAprobados)}</p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-yellow-500/20 bg-yellow-500/5">
          <CardContent className="p-3 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-yellow-500/20">
              <Clock className="h-4 w-4 text-yellow-500" />
            </div>
            <div>
              <p className="text-[11px] text-muted-foreground">Gastos Pendientes</p>
              <p className="text-sm font-bold text-yellow-500">{fmt(stats.totalPendientes)}</p>
            </div>
          </CardContent>
        </Card>

        {baseAsignada > 0 && (
          <Card className={`border-${stats.efectivoEnCaja >= 0 ? "blue" : "red"}-500/20 bg-${stats.efectivoEnCaja >= 0 ? "blue" : "red"}-500/5`}>
            <CardContent className="p-3 flex items-center gap-3">
              <div className={`p-2 rounded-lg bg-${stats.efectivoEnCaja >= 0 ? "blue" : "red"}-500/20`}>
                <ArrowDownCircle className={`h-4 w-4 text-${stats.efectivoEnCaja >= 0 ? "blue" : "red"}-500`} />
              </div>
              <div>
                <p className="text-[11px] text-muted-foreground">Efectivo en Caja</p>
                <p className={`text-sm font-bold text-${stats.efectivoEnCaja >= 0 ? "blue" : "red"}-500`}>{fmt(stats.efectivoEnCaja)}</p>
              </div>
            </CardContent>
          </Card>
        )}

        {stats.reembolsado > 0 && (
          <Card className="border-cyan-500/20 bg-cyan-500/5">
            <CardContent className="p-3 flex items-center gap-3">
              <div className="p-2 rounded-lg bg-cyan-500/20">
                <RotateCcw className="h-4 w-4 text-cyan-500" />
              </div>
              <div>
                <p className="text-[11px] text-muted-foreground">Reembolsado</p>
                <p className="text-sm font-bold text-cyan-500">{fmt(stats.reembolsado)}</p>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Status counts */}
      <div className="grid grid-cols-3 md:grid-cols-5 gap-2">
        <Card>
          <CardContent className="p-2.5 text-center">
            <p className="text-[10px] text-yellow-500">Pendientes</p>
            <p className="text-lg font-bold text-yellow-500">{stats.pendienteCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-2.5 text-center">
            <p className="text-[10px] text-emerald-500">Aprobados</p>
            <p className="text-lg font-bold text-emerald-500">{stats.aprobadoCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-2.5 text-center">
            <p className="text-[10px] text-red-500">No aprobados</p>
            <p className="text-lg font-bold text-red-500">{stats.noAprobadoCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-2.5 text-center">
            <p className="text-[10px] text-blue-500">Legalizados</p>
            <p className="text-lg font-bold text-blue-500">{stats.legalizadoCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-2.5 text-center">
            <p className="text-[10px] text-cyan-500">Reembolsados</p>
            <p className="text-lg font-bold text-cyan-500">{stats.reembolsadoCount}</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default GastosMenoresKPIs;
