import { ExternalLink } from "lucide-react";
import Layout from "@/components/Layout";
import { PanelHeader } from "@/components/PanelHeader";
import { Button } from "@/components/ui/button";
import { useIsMobile } from "@/hooks/use-mobile";

/** Donde vive la herramienta. Es un archivo suelto en public/, no una pantalla React. */
export const RUTA_PLANO_LED = "/plano-led/";

/**
 * Plano LED, dentro del PLANNER.
 *
 * La herramienta es una pagina completa y autosuficiente, con sus propios
 * estilos y su propio manejo del tema. Se muestra en un marco (iframe) en vez
 * de traducirla a componentes por dos razones: sus estilos y los de la
 * plataforma no se pisan, y actualizarla despues es reemplazar un archivo, sin
 * tocar nada del PLANNER.
 *
 * Ese mismo archivo se sirve tal cual en /plano-led/, sin pedir cuenta, asi que
 * el enlace se le puede pasar a un cliente o a un proveedor que no entra al
 * sistema.
 */
const PlanoLed = () => {
  const isMobile = useIsMobile();

  return (
    <Layout>
      <div className={isMobile ? "space-y-2 px-2 pt-1" : "space-y-4"}>
        <PanelHeader
          title="Plano LED"
          description="Dibuja la figura de la pantalla y saca medidas, resolución, consumo y control."
          actions={
            <Button
              variant="outline"
              size="sm"
              onClick={() => window.open(RUTA_PLANO_LED, "_blank", "noopener")}
              className={isMobile ? "h-9 w-full justify-center text-xs" : ""}
              title="Se abre sin necesidad de cuenta: el enlace se puede compartir"
            >
              <ExternalLink className={isMobile ? "mr-1 h-3.5 w-3.5" : "mr-2 h-4 w-4"} />
              Abrir aparte
            </Button>
          }
        />

        {/* Alto fijo por ventana: la herramienta maneja su propio desplazamiento
            adentro, y un marco que crece con el contenido dejaria la pagina con
            dos barras de desplazamiento peleando. */}
        <div
          className="w-full min-w-0 overflow-hidden rounded-lg border border-border"
          style={{ height: isMobile ? "calc(100vh - 210px)" : "calc(100vh - 220px)" }}
        >
          <iframe
            src={RUTA_PLANO_LED}
            title="Plano LED BBM"
            className="h-full w-full border-0"
          />
        </div>
      </div>
    </Layout>
  );
};

export default PlanoLed;
