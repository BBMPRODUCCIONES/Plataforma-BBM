import { useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { DollarSign, Clock, CheckCircle, XCircle } from "lucide-react";

interface AprobacionRow {
  item: { estado: string; valor: number };
  legalizacionTotal: number;
  saldoAFavor: number;
}

interface AprobacionesKPIsProps {
  rows: AprobacionRow[];
}

const AprobacionesKPIs = ({ rows }: AprobacionesKPIsProps) => {
  const stats = useMemo(() => {
    const totalValor = rows.reduce((s, r) => s + (r.item.valor || 0), 0);
    const totalLegalizado = rows.reduce((s, r) => s + (r.legalizacionTotal || 0), 0);
    const pendientes = rows.filter(r => r.item.estado === "Pendiente");
    const aprobados = rows.filter(r => r.item.estado === "Aprobado");
    const noAprobados = rows.filter(r => r.item.estado === "No aprobado");
    const saldoTotal = rows.reduce((s, r) => s + Math.abs(r.saldoAFavor || 0), 0);

    return { totalValor, totalLegalizado, pendientes, aprobados, noAprobados, saldoTotal };
  }, [rows]);

  const fmt = (v: number) =>
    new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(v);

  if (rows.length === 0) return null;

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="p-3 flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/20">
            <DollarSign className="h-4 w-4 text-primary" />
          </div>
          <div>
            <p className="text-[11px] text-muted-foreground">Total Solicitado</p>
            <p className="text-sm font-bold">{fmt(stats.totalValor)}</p>
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
            <p className="text-sm font-bold text-yellow-500">{stats.pendientes.length}</p>
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
            <p className="text-sm font-bold text-emerald-500">{stats.aprobados.length}</p>
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
            <p className="text-sm font-bold text-red-500">{stats.noAprobados.length}</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default AprobacionesKPIs;
