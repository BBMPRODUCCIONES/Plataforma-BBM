import { useState, useEffect, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Download, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";

export interface PhotoExportItem {
  url: string;
  comercio: string;
  concepto: string;
  bucket?: string;
  filePath?: string;
}

interface PhotoExportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  subtitle: string;
  photos: PhotoExportItem[];
}

async function resolveUrl(photo: PhotoExportItem): Promise<string> {
  // If it has bucket/filePath, try to get a fresh signed URL
  if (photo.bucket && photo.filePath) {
    try {
      const { data, error } = await supabase.functions.invoke("get-signed-url", {
        body: { bucket: photo.bucket, path: photo.filePath, expiresIn: 3600 },
      });
      if (!error && data?.signedUrl) return data.signedUrl;
    } catch {}
  }
  // If url looks like a public URL, try getPublicUrl
  if (photo.url && !photo.url.startsWith("blob:")) {
    return photo.url;
  }
  return photo.url;
}

export function PhotoExportDialog({ open, onOpenChange, title, subtitle, photos }: PhotoExportDialogProps) {
  const [resolvedPhotos, setResolvedPhotos] = useState<{ url: string; comercio: string; concepto: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open || photos.length === 0) {
      setResolvedPhotos([]);
      return;
    }
    setLoading(true);
    Promise.all(photos.map(async (p) => {
      const url = await resolveUrl(p);
      return { url, comercio: p.comercio, concepto: p.concepto };
    })).then((resolved) => {
      setResolvedPhotos(resolved);
      setLoading(false);
    });
  }, [open, photos]);

  const handleDownloadPDF = async () => {
    if (!contentRef.current) return;
    setExporting(true);
    try {
      // Create a hidden clone for rendering
      const clone = contentRef.current.cloneNode(true) as HTMLElement;
      clone.style.position = "absolute";
      clone.style.left = "-9999px";
      clone.style.top = "0";
      clone.style.width = "800px";
      clone.style.maxHeight = "none";
      clone.style.overflow = "visible";
      clone.style.background = "#fff";
      clone.style.color = "#000";
      clone.style.padding = "30px";
      // Fix text colors for PDF
      clone.querySelectorAll("*").forEach((el) => {
        const htmlEl = el as HTMLElement;
        htmlEl.style.color = "#000";
      });
      document.body.appendChild(clone);

      const canvas = await html2canvas(clone, {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        backgroundColor: "#ffffff",
      });

      document.body.removeChild(clone);

      const imgData = canvas.toDataURL("image/jpeg", 0.85);
      const pdf = new jsPDF("p", "mm", "a4");
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const margin = 10;
      const usableWidth = pageWidth - margin * 2;
      const imgWidth = usableWidth;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;

      let heightLeft = imgHeight;
      let position = margin;

      pdf.addImage(imgData, "JPEG", margin, position, imgWidth, imgHeight);
      heightLeft -= (pageHeight - margin * 2);

      while (heightLeft > 0) {
        position = -(imgHeight - heightLeft) + margin;
        pdf.addPage();
        pdf.addImage(imgData, "JPEG", margin, position, imgWidth, imgHeight);
        heightLeft -= (pageHeight - margin * 2);
      }

      const safeTitle = title.replace(/[^a-zA-Z0-9áéíóúÁÉÍÓÚñÑ\s\-_]/g, "").trim().replace(/\s+/g, "_");
      pdf.save(`${safeTitle}.pdf`);
    } catch (err) {
      console.error("Error generating PDF:", err);
    } finally {
      setExporting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl max-h-[90vh] flex flex-col p-0 overflow-hidden">
        <DialogHeader className="px-6 pt-6 pb-2 shrink-0">
          <DialogTitle className="text-lg">{title}</DialogTitle>
          <p className="text-sm text-muted-foreground">{subtitle}</p>
        </DialogHeader>
        <div className="px-6 pb-2 flex justify-end shrink-0">
          <Button size="sm" variant="outline" onClick={handleDownloadPDF} disabled={loading || exporting || resolvedPhotos.length === 0}>
            {exporting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Download className="h-4 w-4 mr-2" />}
            {exporting ? "Generando..." : "Guardar PDF"}
          </Button>
        </div>
        <div className="flex-1 overflow-y-auto px-6 pb-6">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              <span className="ml-2 text-sm text-muted-foreground">Cargando imágenes...</span>
            </div>
          ) : (
            <div className="space-y-4">
              {resolvedPhotos.map((img, i) => (
                <div key={i} className="border border-border rounded-lg p-4">
                  <h3 className="font-bold text-sm">{i + 1}. {img.comercio || "Sin comercio"}</h3>
                  <p className="text-xs text-muted-foreground mb-3">{img.concepto || "Sin concepto"}</p>
                  <img
                    src={img.url}
                    alt={`Foto ${i + 1}`}
                    className="max-w-full max-h-[500px] rounded-md mx-auto block"
                    onError={(e) => {
                      (e.target as HTMLImageElement).alt = "Error al cargar imagen";
                    }}
                  />
                </div>
              ))}
              <p className="text-center text-xs text-muted-foreground pt-2">
                Total de fotos: {resolvedPhotos.length}
              </p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
