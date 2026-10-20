import { useState } from "react";
import { Download, Eye, FileText, Loader2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Attachment } from "@/types";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface ListaAdjuntosProps {
  adjuntos: Attachment[];
  etiqueta: string;
  /**
   * Si se pasa, aparece el boton de borrar. Esta lista se abre tambien desde
   * el calendario, que ven todos los roles, asi que el boton no sale por su
   * cuenta: lo habilita quien sabe si el usuario puede borrar.
   *
   * ListaAdjuntos se encarga de quitar el archivo del almacenamiento; la
   * funcion solo tiene que guardar la lista sin ese archivo.
   */
  onBorrar?: (adjunto: Attachment) => void | Promise<void>;
}

/**
 * Lista de archivos ya guardados, para verlos, bajarlos y (si se permite)
 * borrarlos.
 *
 * Los archivos del bucket son privados: no se abren con su url, hay que pedir
 * un enlace firmado que caduca. Por eso no basta con un <a href>.
 */
export function ListaAdjuntos({ adjuntos, etiqueta, onBorrar }: ListaAdjuntosProps) {
  const [cargando, setCargando] = useState<string | null>(null);
  const [borrando, setBorrando] = useState<string | null>(null);

  /**
   * Borra primero del almacenamiento y despues de la lista.
   *
   * Si el almacenamiento falla igual se quita de la lista: dejarlo visible
   * cuando el usuario ya dijo que lo borren es peor que un archivo huerfano
   * en el bucket, que no estorba a nadie. Se avisa para que quede claro.
   */
  const borrar = async (a: Attachment) => {
    if (!onBorrar) return;
    setBorrando(a.id);
    try {
      if (a.filePath && a.bucket) {
        const { error } = await supabase.storage.from(a.bucket).remove([a.filePath]);
        if (error) {
          toast({
            title: "El archivo se quitó de la lista",
            description:
              "No se pudo borrar del almacenamiento, pero ya no aparece en el evento.",
          });
        }
      }
      await onBorrar(a);
    } catch (error: unknown) {
      toast({
        title: "No se pudo borrar",
        description: error instanceof Error ? error.message : "Intenta de nuevo",
        variant: "destructive",
      });
    } finally {
      setBorrando(null);
    }
  };

  if (!adjuntos || adjuntos.length === 0) return null;

  const enlaceDe = async (a: Attachment): Promise<string | null> => {
    if (!a.filePath || !a.bucket) return a.url || null;
    try {
      const { data, error } = await supabase.functions.invoke("get-signed-url", {
        body: { bucket: a.bucket, path: a.filePath, expiresIn: 3600 },
      });
      if (error || !data?.signedUrl) return null;
      return data.signedUrl as string;
    } catch {
      return null;
    }
  };

  const abrir = async (a: Attachment, bajar: boolean) => {
    setCargando(a.id);
    const url = await enlaceDe(a);
    setCargando(null);
    if (!url) {
      toast({
        title: "No se pudo abrir",
        description: "El archivo no está disponible en este momento.",
        variant: "destructive",
      });
      return;
    }
    if (bajar) {
      const enlace = document.createElement("a");
      enlace.href = url;
      enlace.download = a.name;
      enlace.click();
    } else {
      window.open(url, "_blank");
    }
  };

  return (
    <div>
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
        {etiqueta} ({adjuntos.length})
      </div>
      <ul className="mt-1 flex flex-col gap-1">
        {adjuntos.map((a) => (
          <li
            key={a.id}
            className="flex items-center gap-2 rounded-md border border-border/70 px-2 py-1.5"
          >
            <FileText className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            <span className="min-w-0 flex-1 truncate text-sm" title={a.name}>
              {a.name}
            </span>
            {cargando === a.id ? (
              <Loader2 className="h-4 w-4 shrink-0 animate-spin text-muted-foreground" />
            ) : (
              <>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 shrink-0 p-0"
                  onClick={() => abrir(a, false)}
                  title="Ver"
                >
                  <Eye className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 shrink-0 p-0"
                  onClick={() => abrir(a, true)}
                  title="Descargar"
                >
                  <Download className="h-4 w-4" />
                </Button>
                {onBorrar && (
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 shrink-0 p-0 text-destructive hover:bg-destructive/10 hover:text-destructive"
                        title="Borrar archivo"
                        disabled={borrando === a.id}
                      >
                        {borrando === a.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Trash2 className="h-4 w-4" />
                        )}
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>¿Borrar este archivo?</AlertDialogTitle>
                        <AlertDialogDescription>
                          Se va a borrar "{a.name}" del evento y del
                          almacenamiento. No se puede deshacer: si lo necesitas
                          después, toca volver a subirlo.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          onClick={() => borrar(a)}
                        >
                          Borrar
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                )}
              </>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

export default ListaAdjuntos;
