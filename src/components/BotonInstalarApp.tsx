import { useEffect, useState } from "react";
import { Download, MoreVertical, Plus, Share, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  esIOS,
  estaInstalada,
  eventoDeInstalacion,
  instalarDirecto,
  suscribirInstalacion,
} from "@/lib/instalarApp";

/**
 * Boton "Instalar app" de la barra superior del celular.
 *
 * Sale siempre que el planner este abierto en el navegador (no instalado).
 * - Android/Chrome con aviso disponible: abre el dialogo nativo de instalar.
 * - Si el navegador no dio el aviso (o es iPhone): muestra los pasos a mano.
 * Desaparece solo cuando el planner ya se abre como app.
 */
export function BotonInstalarApp() {
  const [instalada, setInstalada] = useState(estaInstalada());
  const [, setVersion] = useState(0);
  const [verPasos, setVerPasos] = useState(false);
  const ios = esIOS();

  useEffect(() => {
    const quitar = suscribirInstalacion(() => setVersion((v) => v + 1));
    const mq = window.matchMedia("(display-mode: standalone)");
    const alCambiar = () => setInstalada(estaInstalada());
    mq.addEventListener("change", alCambiar);
    window.addEventListener("appinstalled", alCambiar);
    return () => {
      quitar();
      mq.removeEventListener("change", alCambiar);
      window.removeEventListener("appinstalled", alCambiar);
    };
  }, []);

  if (instalada) return null;

  const alPulsar = async () => {
    if (!ios && eventoDeInstalacion()) {
      const ok = await instalarDirecto();
      if (ok) setInstalada(true);
      return;
    }
    setVerPasos(true);
  };

  return (
    <>
      <Button
        type="button"
        size="sm"
        variant="outline"
        className="h-7 gap-1 px-2 text-[11px] border-primary/40 text-primary touch-manipulation"
        onClick={alPulsar}
      >
        <Download className="h-3.5 w-3.5" />
        Instalar app
      </Button>

      <Dialog open={verPasos} onOpenChange={setVerPasos}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Smartphone className="h-5 w-5 text-primary" />
              Instalar el planner
            </DialogTitle>
            <DialogDescription>
              Queda como una app en la pantalla de inicio, se abre a pantalla completa y sin
              la barra del navegador.
            </DialogDescription>
          </DialogHeader>

          {ios ? (
            <ol className="space-y-3 py-2 text-sm">
              <Paso n={1}>
                Abre el planner en <strong>Safari</strong> (en otros navegadores del iPhone no
                se puede).
              </Paso>
              <Paso n={2}>
                Toca <Share className="inline h-4 w-4 text-blue-500" /> <strong>Compartir</strong>,
                abajo en el centro.
              </Paso>
              <Paso n={3}>
                Baja y elige <Plus className="inline h-4 w-4" />{" "}
                <strong>"Agregar a pantalla de inicio"</strong>.
              </Paso>
              <Paso n={4}>
                Toca <strong>Agregar</strong>, arriba a la derecha.
              </Paso>
            </ol>
          ) : (
            <ol className="space-y-3 py-2 text-sm">
              <Paso n={1}>
                Abre el planner en <strong>Chrome</strong>.
              </Paso>
              <Paso n={2}>
                Toca el menú <MoreVertical className="inline h-4 w-4" /> (los tres puntos de
                arriba a la derecha).
              </Paso>
              <Paso n={3}>
                Elige <strong>"Instalar app"</strong> o{" "}
                <strong>"Agregar a la pantalla principal"</strong>.
              </Paso>
              <Paso n={4}>
                Confirma con <strong>Instalar</strong>.
              </Paso>
            </ol>
          )}

          <Button className="w-full" onClick={() => setVerPasos(false)}>
            Entendido
          </Button>
        </DialogContent>
      </Dialog>
    </>
  );
}

function Paso({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-3">
      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
        {n}
      </span>
      <span className="pt-0.5 leading-relaxed">{children}</span>
    </li>
  );
}
