import { useMemo, useState } from "react";
import { format, startOfMonth, subMonths } from "date-fns";
import { es } from "date-fns/locale";
import Layout from "@/components/Layout";
import { PanelHeader } from "@/components/PanelHeader";
import { GraficaVentasComercial } from "@/components/GraficaVentasComercial";
import { useProjects } from "@/contexts/ProjectsContext";
import { useIsMobile } from "@/hooks/use-mobile";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

/**
 * Ventas por comercial, en su propio panel.
 *
 * Antes vivia dentro de una ventana del Panel Directivo. Una grafica que se
 * consulta para decidir merece la pantalla completa, no un recuadro: en celular
 * la ventana obligaba a desplazar en dos ejes para leer la tabla del mes.
 *
 * Dos modos: un periodo (la tendencia) o un mes suelto (como va el mes en
 * curso). El mes se guarda como "yyyy-MM" y manda sobre el periodo.
 */
const PERIODOS = [
  { meses: 6, etiqueta: "6 meses" },
  { meses: 12, etiqueta: "12 meses" },
  { meses: 24, etiqueta: "24 meses" },
];

/** Los ultimos 24 meses, del mas reciente al mas viejo. */
function mesesDisponibles() {
  return Array.from({ length: 24 }, (_, i) => {
    const d = startOfMonth(subMonths(new Date(), i));
    return {
      valor: format(d, "yyyy-MM"),
      etiqueta: format(d, "MMMM yyyy", { locale: es }),
    };
  });
}

const PanelVentas = () => {
  const { projects, loading } = useProjects();
  const isMobile = useIsMobile();
  const [meses, setMeses] = useState(12);
  // null = modo periodo. Al entrar a "Mes" se abre en el mes en curso.
  const [mes, setMes] = useState<string | null>(null);
  const opcionesMes = useMemo(mesesDisponibles, []);
  const mesActual = opcionesMes[0].valor;

  const nombreMes = mes
    ? opcionesMes.find((o) => o.valor === mes)?.etiqueta ?? mes
    : "";

  return (
    <Layout>
      <div className={isMobile ? "space-y-2 px-2 pt-1" : "space-y-6"}>
        <PanelHeader
          title="Ventas por comercial"
          description={
            mes
              ? `Ingreso de los eventos con ejecución en ${nombreMes}.`
              : `Ingreso total de los eventos, por mes de ejecución, en los últimos ${meses} meses.`
          }
          actions={
            <div className="flex flex-wrap items-center gap-1.5">
              {PERIODOS.map((p) => (
                <Button
                  key={p.meses}
                  variant={!mes && p.meses === meses ? "default" : "outline"}
                  size="sm"
                  onClick={() => { setMes(null); setMeses(p.meses); }}
                  className={isMobile ? "h-9 flex-1 px-2.5 text-xs" : ""}
                >
                  {p.etiqueta}
                </Button>
              ))}
              <Button
                variant={mes ? "default" : "outline"}
                size="sm"
                onClick={() => setMes(mes ? null : mesActual)}
                className={isMobile ? "h-9 flex-1 px-2.5 text-xs" : ""}
              >
                Mes
              </Button>
            </div>
          }
        />

        {mes && (
          <div className="flex items-center gap-2">
            <Select value={mes} onValueChange={setMes}>
              <SelectTrigger
                className={isMobile ? "h-10 w-full capitalize" : "h-9 w-[220px] capitalize"}
                aria-label="Mes de ventas"
              >
                <SelectValue placeholder="Elige el mes" />
              </SelectTrigger>
              <SelectContent className="max-h-[300px]">
                {opcionesMes.map((o) => (
                  <SelectItem key={o.valor} value={o.valor} className="capitalize">
                    {o.etiqueta}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {loading ? (
          <div className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
            Cargando eventos…
          </div>
        ) : (
          <GraficaVentasComercial projects={projects} meses={meses} mes={mes} />
        )}
      </div>
    </Layout>
  );
};

export default PanelVentas;
