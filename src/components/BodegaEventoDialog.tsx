import { useEffect, useState } from "react";
import { Loader2, Package } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Attachment, Project } from "@/types";
import { AttachmentManager } from "@/components/AttachmentManager";
import { ListaAdjuntos } from "@/components/ListaAdjuntos";
import { toast } from "@/hooks/use-toast";

interface BodegaEventoDialogProps {
  proyecto: Project | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Guarda la observacion escrita. */
  onGuardarObservaciones: (texto: string) => Promise<void>;
  /** Guarda los archivos. Se dispara solo, al subir o quitar uno. */
  onGuardarArchivos: (archivos: Attachment[]) => Promise<void>;
  /** Sin permiso de editar Operaciones se puede mirar y descargar, no tocar. */
  soloLectura?: boolean;
}

/**
 * Bodega del evento: los papeles del despacho y lo que pasó con ellos.
 *
 * Los archivos se guardan al instante, como en las demás columnas de archivos,
 * porque subir ya es una acción deliberada. El texto no: se guarda con el botón,
 * para que cerrar la ventana a media frase no deje media frase guardada.
 */
export function BodegaEventoDialog({
  proyecto,
  open,
  onOpenChange,
  onGuardarObservaciones,
  onGuardarArchivos,
  soloLectura = false,
}: BodegaEventoDialogProps) {
  const [texto, setTexto] = useState("");
  const [guardando, setGuardando] = useState(false);

  // Cada vez que se abre, se parte de lo que hay guardado: si no, una ventana
  // reabierta mostraria lo que se escribio para otro evento.
  useEffect(() => {
    if (open) setTexto(proyecto?.bodegaObservaciones || "");
  }, [open, proyecto?.id, proyecto?.bodegaObservaciones]);

  if (!proyecto) return null;

  const archivos = proyecto.bodegaArchivos || [];
  const sinCambios = texto === (proyecto.bodegaObservaciones || "");

  const guardar = async () => {
    setGuardando(true);
    try {
      await onGuardarObservaciones(texto);
      toast({ title: "Observación de bodega guardada" });
      onOpenChange(false);
    } catch (e) {
      toast({
        title: "No se pudo guardar",
        description: e instanceof Error ? e.message : "Intenta de nuevo.",
        variant: "destructive",
      });
    } finally {
      setGuardando(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[85vh] max-w-2xl flex-col overflow-x-hidden">
        <DialogHeader className="pr-10">
          <DialogTitle className="flex items-center gap-2 text-left">
            <Package className="h-4 w-4 shrink-0" />
            Bodega — {proyecto.evento}
          </DialogTitle>
          <DialogDescription className="text-left">
            Remisiones, listas de despacho y fotos de salida y entrada, más lo
            que haya que dejar anotado del movimiento de equipos.
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto">
          <div className="w-full min-w-0 space-y-2 rounded-lg border border-border p-3">
            <div className="text-xs font-medium text-muted-foreground">
              Archivos (remisiones, listas de despacho, fotos)
            </div>
            {soloLectura ? (
              archivos.length > 0 ? (
                <ListaAdjuntos adjuntos={archivos} etiqueta="Archivos" />
              ) : (
                <p className="text-[11px] text-muted-foreground">
                  Sin archivos cargados.
                </p>
              )
            ) : (
              <AttachmentManager
                attachments={archivos}
                onAttachmentsChange={(nuevos) => {
                  void onGuardarArchivos(nuevos);
                }}
                acceptedTypes=".pdf,.jpg,.jpeg,.png,.xlsx,.xls,.doc,.docx"
                fieldName="bodega"
                projectId={proyecto.id}
              />
            )}
          </div>

          <div className="w-full min-w-0 space-y-2 rounded-lg border border-border p-3">
            <div className="text-xs font-medium text-muted-foreground">
              Observaciones de bodega
            </div>
            {soloLectura ? (
              proyecto.bodegaObservaciones?.trim() ? (
                <p className="whitespace-pre-wrap text-sm">
                  {proyecto.bodegaObservaciones}
                </p>
              ) : (
                <p className="text-[11px] text-muted-foreground">
                  Sin observaciones.
                </p>
              )
            ) : (
              <Textarea
                value={texto}
                onChange={(e) => setTexto(e.target.value)}
                rows={6}
                placeholder="Novedades del despacho, faltantes, estado en que salieron y volvieron los equipos…"
                className="resize-y text-sm"
              />
            )}
          </div>
        </div>

        <DialogFooter className="shrink-0">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {soloLectura ? "Cerrar" : "Cancelar"}
          </Button>
          {!soloLectura && (
            <Button onClick={guardar} disabled={guardando || sinCambios}>
              {guardando && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Guardar observación
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default BodegaEventoDialog;
