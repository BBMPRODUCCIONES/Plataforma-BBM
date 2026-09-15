import { useState } from "react";
import Layout from "@/components/Layout";
import { PanelHeader } from "@/components/PanelHeader";
import { GraficaVentasComercial } from "@/components/GraficaVentasComercial";
import { useProjects } from "@/contexts/ProjectsContext";
import { useIsMobile } from "@/hooks/use-mobile";
import { Button } from "@/components/ui/button";

/**
 * Ventas por comercial, en su propio panel.
 *
 * Antes vivia dentro de una ventana del Panel Directivo. Una grafica que se
 * consulta para decidir merece la pantalla completa, no un recuadro: en celular
 * la ventana obligaba a desplazar en dos ejes para leer la tabla del mes.
 */
const PERIODOS = [
  { meses: 6, etiqueta: "6 meses" },
  { meses: 12, etiqueta: "12 meses" },
  { meses: 24, etiqueta: "24 meses" },
];

const PanelVentas = () => {
  const { projects, loading } = useProjects();
  const isMobile = useIsMobile();
  const [meses, setMeses] = useState(12);

  return (
    <Layout>
      <div className={isMobile ? "space-y-2 px-2 pt-1" : "space-y-6"}>
        <PanelHeader
          title="Ventas por comercial"
          description={`Ingreso total de los eventos, por mes de ejecución, en los últimos ${meses} meses.`}
          actions={
            <div className="flex gap-1.5">
              {PERIODOS.map((p) => (
                <Button
                  key={p.meses}
                  variant={p.meses === meses ? "default" : "outline"}
                  size="sm"
                  onClick={() => setMeses(p.meses)}
                  className={isMobile ? "h-9 flex-1 px-2.5 text-xs" : ""}
                >
                  {p.etiqueta}
                </Button>
              ))}
            </div>
          }
        />

        {loading ? (
          <div className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
            Cargando eventos…
          </div>
        ) : (
          <GraficaVentasComercial projects={projects} meses={meses} />
        )}
      </div>
    </Layout>
  );
};

export default PanelVentas;
