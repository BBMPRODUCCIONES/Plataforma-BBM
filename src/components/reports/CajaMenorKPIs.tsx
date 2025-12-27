import { useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { DollarSign, TrendingUp, AlertTriangle, ShoppingCart, Utensils, Car } from "lucide-react";
import { CajaMenorItem } from "@/types";

interface FlattenedCajaMenorItem extends CajaMenorItem {
  eventoId: string;
  eventoNombre: string;
  recibo: string;
  fecha: string;
}

interface CajaMenorKPIsProps {
  items: FlattenedCajaMenorItem[];
}

const CajaMenorKPIs = ({ items }: CajaMenorKPIsProps) => {
  const stats = useMemo(() => {
    const totalValor = items.reduce((sum, item) => sum + (item.valor || 0), 0);
    const totalAprobado = items
      .filter(item => item.estado === 'Aprobado')
      .reduce((sum, item) => sum + (item.valor || 0), 0);
    const totalContingencia = items
      .filter(item => item.contingencia === 'Sí')
      .reduce((sum, item) => sum + (item.valor || 0), 0);
    
    // By category
    const byCategoria = {
      Transporte: items.filter(i => i.categoria === 'Transporte').reduce((s, i) => s + (i.valor || 0), 0),
      Alimentación: items.filter(i => i.categoria === 'Alimentación').reduce((s, i) => s + (i.valor || 0), 0),
      Compras: items.filter(i => i.categoria === 'Compras').reduce((s, i) => s + (i.valor || 0), 0),
    };

    // By recursos
    const byRecursos = {
      'Recursos propios': items.filter(i => i.recursos === 'Recursos propios').reduce((s, i) => s + (i.valor || 0), 0),
      'BBM': items.filter(i => i.recursos === 'BBM').reduce((s, i) => s + (i.valor || 0), 0),
      'Anticipo BBM': items.filter(i => i.recursos === 'Anticipo BBM').reduce((s, i) => s + (i.valor || 0), 0),
    };

    return {
      totalValor,
      totalAprobado,
      totalContingencia,
      byCategoria,
      byRecursos,
      totalRegistros: items.length,
    };
  }, [items]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  return (
    <div className="space-y-4">
      {/* Main KPIs Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* Total Valor */}
        <Card className="bg-gradient-to-br from-primary/10 to-primary/5 border-primary/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/20">
                <DollarSign className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Total General</p>
                <p className="text-lg font-bold text-foreground">{formatCurrency(stats.totalValor)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Total Aprobado */}
        <Card className="bg-gradient-to-br from-emerald-500/10 to-emerald-500/5 border-emerald-500/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-emerald-500/20">
                <TrendingUp className="h-5 w-5 text-emerald-500" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Total Aprobado</p>
                <p className="text-lg font-bold text-emerald-500">{formatCurrency(stats.totalAprobado)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Total Contingencia */}
        <Card className="bg-gradient-to-br from-amber-500/10 to-amber-500/5 border-amber-500/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-amber-500/20">
                <AlertTriangle className="h-5 w-5 text-amber-500" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Total Contingencia</p>
                <p className="text-lg font-bold text-amber-500">{formatCurrency(stats.totalContingencia)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Total Registros */}
        <Card className="bg-gradient-to-br from-blue-500/10 to-blue-500/5 border-blue-500/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-500/20">
                <DollarSign className="h-5 w-5 text-blue-500" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Total Registros</p>
                <p className="text-lg font-bold text-blue-500">{stats.totalRegistros}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Secondary KPIs - By Category and Resources */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* By Category */}
        <Card>
          <CardContent className="p-4">
            <h3 className="text-sm font-medium text-muted-foreground mb-3">Por Categoría</h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Car className="h-4 w-4 text-blue-500" />
                  <span className="text-sm">Transporte</span>
                </div>
                <span className="font-medium">{formatCurrency(stats.byCategoria.Transporte)}</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Utensils className="h-4 w-4 text-orange-500" />
                  <span className="text-sm">Alimentación</span>
                </div>
                <span className="font-medium">{formatCurrency(stats.byCategoria.Alimentación)}</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ShoppingCart className="h-4 w-4 text-purple-500" />
                  <span className="text-sm">Compras</span>
                </div>
                <span className="font-medium">{formatCurrency(stats.byCategoria.Compras)}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* By Resources */}
        <Card>
          <CardContent className="p-4">
            <h3 className="text-sm font-medium text-muted-foreground mb-3">Por Recursos</h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm">Recursos propios</span>
                <span className="font-medium">{formatCurrency(stats.byRecursos['Recursos propios'])}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">BBM</span>
                <span className="font-medium">{formatCurrency(stats.byRecursos['BBM'])}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">Anticipo BBM</span>
                <span className="font-medium">{formatCurrency(stats.byRecursos['Anticipo BBM'])}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default CajaMenorKPIs;
