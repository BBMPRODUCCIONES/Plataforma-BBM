import { useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { CajaMenorItem } from "@/types";

interface FlattenedCajaMenorItem extends CajaMenorItem {
  eventoId: string;
  eventoNombre: string;
  recibo: string;
  fecha: string;
}

interface CajaMenorDashboardProps {
  items: FlattenedCajaMenorItem[];
}

const COLORS = {
  recursosPropios: "#22c55e", // Green
  bbm: "#06b6d4",             // Cyan
  anticipo: "#ef4444",        // Red
};

const CATEGORY_COLORS = {
  Transporte: "#3b82f6",      // Blue
  Alimentación: "#f97316",    // Orange
  Compras: "#a855f7",         // Purple
};

interface CategoryStats {
  name: string;
  total: number;
  percentage: number;
  recursosPropios: { valor: number; percentage: number };
  bbm: { valor: number; percentage: number };
  anticipo: { valor: number; percentage: number };
  contingenciaPct: number;
  donutData: { name: string; value: number; color: string }[];
}

const CajaMenorDashboard = ({ items }: CajaMenorDashboardProps) => {
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("es-CO", {
      style: "currency",
      currency: "COP",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const formatCurrencyShort = (value: number) => {
    if (value >= 1000000) {
      return `$${(value / 1000000).toFixed(1)}M`;
    } else if (value >= 1000) {
      return `$${(value / 1000).toFixed(0)}K`;
    }
    return formatCurrency(value);
  };

  const { totalPagos, categoriaStats } = useMemo(() => {
    const totalPagos = items.reduce((sum, item) => sum + (item.valor || 0), 0);

    const categories: ("Transporte" | "Alimentación" | "Compras")[] = ["Transporte", "Alimentación", "Compras"];
    
    const categoriaStats: CategoryStats[] = categories.map((categoria) => {
      const categoryItems = items.filter((i) => i.categoria === categoria);
      const total = categoryItems.reduce((sum, i) => sum + (i.valor || 0), 0);
      const percentage = totalPagos > 0 ? (total / totalPagos) * 100 : 0;

      // Recursos distribution
      const recursosPropiosVal = categoryItems
        .filter((i) => i.recursos === "Recursos propios")
        .reduce((sum, i) => sum + (i.valor || 0), 0);
      const bbmVal = categoryItems
        .filter((i) => i.recursos === "BBM")
        .reduce((sum, i) => sum + (i.valor || 0), 0);
      const anticipoVal = categoryItems
        .filter((i) => i.recursos === "Anticipo BBM")
        .reduce((sum, i) => sum + (i.valor || 0), 0);

      // Contingencia percentage
      const contingenciaCount = categoryItems.filter((i) => i.contingencia === "Sí").length;
      const contingenciaPct = categoryItems.length > 0 
        ? (contingenciaCount / categoryItems.length) * 100 
        : 0;

      // Donut data
      const donutData = [
        { name: "Recursos propios", value: recursosPropiosVal, color: COLORS.recursosPropios },
        { name: "BBM", value: bbmVal, color: COLORS.bbm },
        { name: "Anticipo BBM", value: anticipoVal, color: COLORS.anticipo },
      ].filter((d) => d.value > 0);

      return {
        name: categoria,
        total,
        percentage,
        recursosPropios: {
          valor: recursosPropiosVal,
          percentage: total > 0 ? (recursosPropiosVal / total) * 100 : 0,
        },
        bbm: {
          valor: bbmVal,
          percentage: total > 0 ? (bbmVal / total) * 100 : 0,
        },
        anticipo: {
          valor: anticipoVal,
          percentage: total > 0 ? (anticipoVal / total) * 100 : 0,
        },
        contingenciaPct,
        donutData,
      };
    });

    return { totalPagos, categoriaStats };
  }, [items]);

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-card border border-border rounded-lg p-2 shadow-lg">
          <p className="text-sm font-medium text-foreground">{data.name}</p>
          <p className="text-sm text-muted-foreground">{formatCurrency(data.value)}</p>
        </div>
      );
    }
    return null;
  };

  return (
    <Card className="bg-card/50 border-border/50 backdrop-blur-sm">
      <CardContent className="p-4 md:p-6">
        {/* Total de Pagos - Header */}
        <div className="text-center mb-6">
          <h2 className="text-sm md:text-base font-medium text-muted-foreground uppercase tracking-wider mb-1">
            Total de Pagos
          </h2>
          <p className="text-2xl md:text-4xl font-bold text-foreground transition-all duration-300">
            {formatCurrency(totalPagos)}
          </p>
        </div>

        {/* Categories Grid with Donuts */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
          {categoriaStats.map((cat) => (
            <div 
              key={cat.name} 
              className="flex flex-col items-center p-4 rounded-xl bg-background/50 border border-border/30 transition-all duration-300 hover:border-border/60"
            >
              {/* Category Header */}
              <div className="text-center mb-2">
                <span 
                  className="text-lg md:text-xl font-bold"
                  style={{ color: CATEGORY_COLORS[cat.name as keyof typeof CATEGORY_COLORS] }}
                >
                  {cat.percentage.toFixed(0)}%
                </span>
                <span className="text-sm md:text-base font-medium text-muted-foreground ml-2">
                  {cat.name.toUpperCase()}
                </span>
              </div>
              <p className="text-sm md:text-base font-semibold text-foreground mb-3">
                {formatCurrency(cat.total)}
              </p>

              {/* Donut Chart */}
              <div className="relative w-[140px] h-[140px] md:w-[160px] md:h-[160px]">
                {cat.donutData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={cat.donutData}
                        cx="50%"
                        cy="50%"
                        innerRadius={40}
                        outerRadius={60}
                        paddingAngle={2}
                        dataKey="value"
                        isAnimationActive={true}
                        animationDuration={500}
                      >
                        {cat.donutData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip content={<CustomTooltip />} />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="w-full h-full rounded-full border-4 border-dashed border-muted flex items-center justify-center">
                    <span className="text-xs text-muted-foreground">Sin datos</span>
                  </div>
                )}
                
                {/* Center text - Contingencia */}
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <span className="text-[10px] md:text-xs text-muted-foreground uppercase tracking-tight">
                    Contingencia
                  </span>
                  <span className="text-base md:text-lg font-bold text-foreground">
                    {cat.contingenciaPct.toFixed(0)}%
                  </span>
                </div>
              </div>

              {/* Resource breakdown - below donut */}
              <div className="mt-3 w-full space-y-1.5">
                {cat.recursosPropios.valor > 0 && (
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-1.5">
                      <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: COLORS.recursosPropios }} />
                      <span className="text-muted-foreground">Rec. propios</span>
                    </div>
                    <span className="font-medium text-foreground">
                      {formatCurrencyShort(cat.recursosPropios.valor)}
                    </span>
                  </div>
                )}
                {cat.bbm.valor > 0 && (
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-1.5">
                      <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: COLORS.bbm }} />
                      <span className="text-muted-foreground">BBM</span>
                    </div>
                    <span className="font-medium text-foreground">
                      {formatCurrencyShort(cat.bbm.valor)}
                    </span>
                  </div>
                )}
                {cat.anticipo.valor > 0 && (
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-1.5">
                      <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: COLORS.anticipo }} />
                      <span className="text-muted-foreground">Anticipo</span>
                    </div>
                    <span className="font-medium text-foreground">
                      {formatCurrencyShort(cat.anticipo.valor)}
                    </span>
                  </div>
                )}
                {cat.donutData.length === 0 && (
                  <p className="text-xs text-muted-foreground text-center">Sin registros</p>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Legend */}
        <div className="flex flex-wrap justify-center gap-4 md:gap-6 mt-4 pt-4 border-t border-border/30">
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS.recursosPropios }} />
            <span className="text-xs text-muted-foreground">Recursos propios</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS.bbm }} />
            <span className="text-xs text-muted-foreground">BBM</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS.anticipo }} />
            <span className="text-xs text-muted-foreground">Anticipo BBM</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default CajaMenorDashboard;
