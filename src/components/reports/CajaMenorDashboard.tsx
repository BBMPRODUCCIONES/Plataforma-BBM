import { useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
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

interface DonutSegment {
  name: string;
  value: number;
  color: string;
  percentage: number;
  startAngle: number;
  endAngle: number;
}

interface CategoryStats {
  name: string;
  total: number;
  percentage: number;
  recursosPropios: { valor: number; percentage: number };
  bbm: { valor: number; percentage: number };
  anticipo: { valor: number; percentage: number };
  contingenciaPct: number;
  donutData: DonutSegment[];
  contingenciaByRecurso: {
    recursosPropios: ResourceContingencia;
    bbm: ResourceContingencia;
    anticipo: ResourceContingencia;
  };
}

// SVG Donut Component - Single donut with white external + colored internal percentages
const DonutChart = ({ 
  data, 
  contingenciaPct,
  contingenciaByRecurso,
  size = 200 
}: { 
  data: DonutSegment[];
  contingenciaPct: number;
  contingenciaByRecurso: {
    recursosPropios: ResourceContingencia;
    bbm: ResourceContingencia;
    anticipo: ResourceContingencia;
  };
  size?: number;
}) => {
  const center = size / 2;
  const outerRadius = size * 0.42;
  const innerRadius = size * 0.26;
  const externalLabelRadius = size * 0.50; // White percentages OUTSIDE
  const internalLabelRadius = size * 0.20; // Colored contingency percentages INSIDE

  // Calculate segments with angles
  const segments = useMemo(() => {
    let currentAngle = -90; // Start from top
    return data.map((segment) => {
      const angle = (segment.percentage / 100) * 360;
      const startAngle = currentAngle;
      const endAngle = currentAngle + angle;
      currentAngle = endAngle;
      return { ...segment, startAngle, endAngle };
    });
  }, [data]);

  // Convert polar to cartesian
  const polarToCartesian = (angle: number, radius: number) => {
    const rad = (angle * Math.PI) / 180;
    return {
      x: center + radius * Math.cos(rad),
      y: center + radius * Math.sin(rad),
    };
  };

  // Create arc path for donut segment
  const createArc = (startAngle: number, endAngle: number, outerR: number, innerR: number) => {
    const start = polarToCartesian(startAngle, outerR);
    const end = polarToCartesian(endAngle, outerR);
    const innerStart = polarToCartesian(startAngle, innerR);
    const innerEnd = polarToCartesian(endAngle, innerR);
    const largeArc = endAngle - startAngle > 180 ? 1 : 0;

    return `M ${start.x} ${start.y} A ${outerR} ${outerR} 0 ${largeArc} 1 ${end.x} ${end.y} L ${innerEnd.x} ${innerEnd.y} A ${innerR} ${innerR} 0 ${largeArc} 0 ${innerStart.x} ${innerStart.y} Z`;
  };

  // Get label position at mid-angle
  const getLabelPosition = (startAngle: number, endAngle: number, radius: number) => {
    const midAngle = (startAngle + endAngle) / 2;
    return polarToCartesian(midAngle, radius);
  };

  // Get contingency percentage for a segment name
  const getContingenciaPct = (segmentName: string): number => {
    switch (segmentName) {
      case "Recursos propios":
        return contingenciaByRecurso.recursosPropios.percentage;
      case "BBM":
        return contingenciaByRecurso.bbm.percentage;
      case "Anticipo BBM":
        return contingenciaByRecurso.anticipo.percentage;
      default:
        return 0;
    }
  };

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="overflow-visible">
      {/* Main donut segments */}
      {segments.map((segment, index) => (
        <path
          key={`segment-${index}`}
          d={createArc(segment.startAngle, segment.endAngle, outerRadius, innerRadius)}
          fill={segment.color}
          className="transition-all duration-300 hover:opacity-80"
        />
      ))}

      {/* WHITE percentage labels OUTSIDE the donut (distribution by value) */}
      {segments.map((segment, index) => {
        if (segment.percentage < 3) return null;
        const pos = getLabelPosition(segment.startAngle, segment.endAngle, externalLabelRadius);
        return (
          <text
            key={`external-label-${index}`}
            x={pos.x}
            y={pos.y}
            textAnchor="middle"
            dominantBaseline="middle"
            fill="white"
            style={{ 
              fontSize: size > 180 ? '16px' : '13px',
              fontWeight: 700,
              filter: "drop-shadow(0 1px 3px rgba(0,0,0,0.5))" 
            }}
          >
            {segment.percentage.toFixed(0)}%
          </text>
        );
      })}

      {/* COLORED percentage labels INSIDE the donut (contingency by resource) */}
      {segments.map((segment, index) => {
        const contingencia = getContingenciaPct(segment.name);
        if (segment.percentage < 3) return null;
        const pos = getLabelPosition(segment.startAngle, segment.endAngle, internalLabelRadius);
        return (
          <text
            key={`internal-label-${index}`}
            x={pos.x}
            y={pos.y}
            textAnchor="middle"
            dominantBaseline="middle"
            fill={segment.color}
            style={{ 
              fontSize: size > 180 ? '11px' : '9px',
              fontWeight: 600,
              filter: "drop-shadow(0 1px 2px rgba(0,0,0,0.4))" 
            }}
          >
            {contingencia.toFixed(0)}%
          </text>
        );
      })}

      {/* Center content - only contingencia text and percentage */}
      <foreignObject x={center - 40} y={center - 22} width={80} height={44}>
        <div className="w-full h-full flex flex-col items-center justify-center">
          <span className="text-[9px] uppercase tracking-wider text-muted-foreground/60">
            contingencia
          </span>
          <span className="text-base font-bold text-foreground/80">
            {contingenciaPct.toFixed(0)}%
          </span>
        </div>
      </foreignObject>
    </svg>
  );
};

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

      // Donut data (by value) with percentage
      const donutData: DonutSegment[] = [
        { 
          name: "Recursos propios", 
          value: recursosPropiosVal, 
          color: COLORS.recursosPropios,
          percentage: total > 0 ? (recursosPropiosVal / total) * 100 : 0,
          startAngle: 0,
          endAngle: 0,
        },
        { 
          name: "BBM", 
          value: bbmVal, 
          color: COLORS.bbm,
          percentage: total > 0 ? (bbmVal / total) * 100 : 0,
          startAngle: 0,
          endAngle: 0,
        },
        { 
          name: "Anticipo BBM", 
          value: anticipoVal, 
          color: COLORS.anticipo,
          percentage: total > 0 ? (anticipoVal / total) * 100 : 0,
          startAngle: 0,
          endAngle: 0,
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
      };
    });

    return { totalPagos, categoriaStats };
  }, [items]);

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
                  className="text-lg md:text-xl font-bold text-foreground"
                >
                  {cat.percentage.toFixed(0)}%
                </span>
                <span className="text-sm md:text-base font-medium text-muted-foreground ml-2 uppercase">
                  {cat.name}
                </span>
              </div>
              <p className="text-sm md:text-base font-semibold text-foreground mb-3">
                {formatCurrency(cat.total)}
              </p>

              {/* Custom SVG Donut Chart */}
              <div className="relative">
                {cat.donutData.length > 0 ? (
                  <DonutChart
                    data={cat.donutData}
                    contingenciaPct={cat.contingenciaPct}
                    contingenciaByRecurso={cat.contingenciaByRecurso}
                    size={200}
                  />
                ) : (
                  <div className="w-[200px] h-[200px] rounded-full border-4 border-dashed border-muted flex items-center justify-center">
                    <span className="text-xs text-muted-foreground">Sin datos</span>
                  </div>
                )}
              </div>

              {/* Resource breakdown */}
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
