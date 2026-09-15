import { useState } from "react";
import { Download, Eye, FileText, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Attachment } from "@/types";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

interface ListaAdjuntosProps {
  adjuntos: Attachment[];
  etiqueta: string;
}

/**
 * Lista de archivos ya guardados, solo para verlos o bajarlos.
 *
 * Los archivos del bucket son privados: no se abren con su url, hay que pedir
 * un enlace firmado que caduca. Por eso no basta con un <a href>.
 */
export function ListaAdjuntos({ adjuntos, etiqueta }: ListaAdjuntosProps) {
  const [cargando, setCargando] = useState<string | null>(null);

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
              </>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

export default ListaAdjuntos;
