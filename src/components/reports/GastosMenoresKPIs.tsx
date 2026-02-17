import { useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { DollarSign, Clock, CheckCircle, XCircle, Utensils, Car, ShoppingBag, Sparkles, Wrench } from "lucide-react";
import { GastoMenor } from "@/hooks/useGastosMenores";

interface GastosMenoresKPIsProps {
  gastos: GastoMenor[];
}

const GastosMenoresKPIs = ({ gastos }: GastosMenoresKPIsProps) => {
  const stats = useMemo(() => {
    const total = gastos.reduce((s, g) => s + g.valor, 0);
    const pendiente = gastos.filter(g => g.estado === "Pendiente");
    const aprobado = gastos.filter(g => g.estado === "Aprobado");
    const noAprobado = gastos.filter(g => g.estado === "No aprobado");

    const byCategoria: Record<string, number> = {};
    gastos.forEach(g => {
      byCategoria[g.categoria] = (byCategoria[g.categoria] || 0) + g.valor;
    });

    return { total, pendiente, aprobado, noAprobado, byCategoria };
  }, [gastos]);

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

      {/* By category */}
      {Object.keys(stats.byCategoria).length > 0 && (
        <Card>
          <CardContent className="p-3">
            <p className="text-xs text-muted-foreground mb-2">Por Categoría</p>
            <div className="flex flex-wrap gap-4">
              {Object.entries(stats.byCategoria).map(([cat, val]) => (
                <div key={cat} className="flex items-center gap-1.5 text-sm">
                  {catIcon[cat] || <DollarSign className="h-3.5 w-3.5" />}
                  <span className="text-muted-foreground">{cat}:</span>
                  <span className="font-medium">{fmt(val)}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default GastosMenoresKPIs;
