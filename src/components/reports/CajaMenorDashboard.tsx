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

interface ResourceContingencia {
  totalRecords: number;
  contingenciaRecords: number;
  percentage: number;
}

interface CategoryStats {
  name: string;
  total: number;
  percentage: number;
  recursosPropios: { valor: number; percentage: number };
  bbm: { valor: number; percentage: number };
  anticipo: { valor: number; percentage: number };
  contingenciaPct: number;
  donutData: { name: string; value: number; color: string }[];
  // Contingencia por recurso (por cantidad de registros)
  contingenciaByRecurso: {
    recursosPropios: ResourceContingencia;
    bbm: ResourceContingencia;
    anticipo: ResourceContingencia;
  };
  innerDonutData: { name: string; value: number; color: string }[];
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

      // Recursos distribution by VALUE
      const recursosPropiosItems = categoryItems.filter((i) => i.recursos === "Recursos propios");
      const bbmItems = categoryItems.filter((i) => i.recursos === "BBM");
      const anticipoItems = categoryItems.filter((i) => i.recursos === "Anticipo BBM");

      const recursosPropiosVal = recursosPropiosItems.reduce((sum, i) => sum + (i.valor || 0), 0);
      const bbmVal = bbmItems.reduce((sum, i) => sum + (i.valor || 0), 0);
      const anticipoVal = anticipoItems.reduce((sum, i) => sum + (i.valor || 0), 0);

      // Contingencia by RECORD COUNT per resource
      const calcContingencia = (resourceItems: typeof categoryItems): ResourceContingencia => {
        const totalRecords = resourceItems.length;
        const contingenciaRecords = resourceItems.filter((i) => i.contingencia === "Sí").length;
        const percentage = totalRecords > 0 ? (contingenciaRecords / totalRecords) * 100 : 0;
        return { totalRecords, contingenciaRecords, percentage };
      };

      const contingenciaByRecurso = {
        recursosPropios: calcContingencia(recursosPropiosItems),
        bbm: calcContingencia(bbmItems),
        anticipo: calcContingencia(anticipoItems),
      };

      // Total contingencia percentage (weighted by record count)
      const totalRecords = categoryItems.length;
      const totalContingenciaRecords = categoryItems.filter((i) => i.contingencia === "Sí").length;
      const contingenciaPct = totalRecords > 0 ? (totalContingenciaRecords / totalRecords) * 100 : 0;

      // Outer donut data (by value)
      const donutData = [
        { name: "Recursos propios", value: recursosPropiosVal, color: COLORS.recursosPropios },
        { name: "BBM", value: bbmVal, color: COLORS.bbm },
        { name: "Anticipo BBM", value: anticipoVal, color: COLORS.anticipo },
      ].filter((d) => d.value > 0);

      // Inner donut data (contingencia by record count per resource)
      // Shows the proportion of contingencia records per resource type
      const innerDonutData = [
        { 
          name: "Rec. propios", 
          value: contingenciaByRecurso.recursosPropios.contingenciaRecords, 
          color: COLORS.recursosPropios 
        },
        { 
          name: "BBM", 
          value: contingenciaByRecurso.bbm.contingenciaRecords, 
          color: COLORS.bbm 
        },
        { 
          name: "Anticipo", 
          value: contingenciaByRecurso.anticipo.contingenciaRecords, 
          color: COLORS.anticipo 
        },
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
        contingenciaByRecurso,
        innerDonutData,
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
          <p className="text-sm text-muted-foreground">
            {typeof data.value === "number" && data.value >= 1000 
              ? formatCurrency(data.value) 
              : `${data.value} registros`}
          </p>
        </div>
      );
    }
    return null;
  };

  const InnerTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-card border border-border rounded-lg p-2 shadow-lg">
          <p className="text-sm font-medium text-foreground">{data.name}</p>
          <p className="text-sm text-muted-foreground">{data.value} contingencia(s)</p>
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

              {/* Double Donut Chart */}
              <div className="relative w-[180px] h-[180px] md:w-[200px] md:h-[200px]">
                {cat.donutData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      {/* Outer Ring - Resource Distribution by VALUE */}
                      <Pie
                        data={cat.donutData}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={80}
                        paddingAngle={2}
                        dataKey="value"
                        isAnimationActive={true}
                        animationDuration={500}
                      >
                        {cat.donutData.map((entry, index) => (
                          <Cell key={`outer-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      
                      {/* Inner Ring - Contingencia by RECORD COUNT */}
                      {cat.innerDonutData.length > 0 && (
                        <Pie
                          data={cat.innerDonutData}
                          cx="50%"
                          cy="50%"
                          innerRadius={35}
                          outerRadius={50}
                          paddingAngle={2}
                          dataKey="value"
                          isAnimationActive={true}
                          animationDuration={500}
                        >
                          {cat.innerDonutData.map((entry, index) => (
                            <Cell key={`inner-${index}`} fill={entry.color} opacity={0.7} />
                          ))}
                        </Pie>
                      )}
                      
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
                  <span className="text-[9px] md:text-[10px] text-muted-foreground uppercase tracking-tight font-medium">
                    Contingencia
                  </span>
                  <span className="text-lg md:text-xl font-bold text-foreground">
                    {cat.contingenciaPct.toFixed(0)}%
                  </span>
                </div>
              </div>

              {/* Resource breakdown with contingencia info */}
              <div className="mt-3 w-full space-y-1.5">
                {cat.recursosPropios.valor > 0 && (
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-1.5">
                      <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: COLORS.recursosPropios }} />
                      <span className="text-muted-foreground">Rec. propios</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-foreground">
                        {formatCurrencyShort(cat.recursosPropios.valor)}
                      </span>
                      {cat.contingenciaByRecurso.recursosPropios.contingenciaRecords > 0 && (
                        <span className="text-[10px] text-muted-foreground">
                          ({cat.contingenciaByRecurso.recursosPropios.percentage.toFixed(0)}% cont.)
                        </span>
                      )}
                    </div>
                  </div>
                )}
                {cat.bbm.valor > 0 && (
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-1.5">
                      <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: COLORS.bbm }} />
                      <span className="text-muted-foreground">BBM</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-foreground">
                        {formatCurrencyShort(cat.bbm.valor)}
                      </span>
                      {cat.contingenciaByRecurso.bbm.contingenciaRecords > 0 && (
                        <span className="text-[10px] text-muted-foreground">
                          ({cat.contingenciaByRecurso.bbm.percentage.toFixed(0)}% cont.)
                        </span>
                      )}
                    </div>
                  </div>
                )}
                {cat.anticipo.valor > 0 && (
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-1.5">
                      <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: COLORS.anticipo }} />
                      <span className="text-muted-foreground">Anticipo</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-foreground">
                        {formatCurrencyShort(cat.anticipo.valor)}
                      </span>
                      {cat.contingenciaByRecurso.anticipo.contingenciaRecords > 0 && (
                        <span className="text-[10px] text-muted-foreground">
                          ({cat.contingenciaByRecurso.anticipo.percentage.toFixed(0)}% cont.)
                        </span>
                      )}
                    </div>
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
