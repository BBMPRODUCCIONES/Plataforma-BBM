import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Download } from "lucide-react";

export interface PhotoExportItem {
  url: string;
  comercio: string;
  concepto: string;
}

interface PhotoExportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  subtitle: string;
  photos: PhotoExportItem[];
}

export function PhotoExportDialog({ open, onOpenChange, title, subtitle, photos }: PhotoExportDialogProps) {
  const handlePrint = () => {
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;
    const html = `<!DOCTYPE html><html><head><title>${title}</title><style>
      @media print { .no-print { display: none !important; } @page { margin: 10mm; } }
      body { font-family: Arial, sans-serif; margin: 0; padding: 20px; background: #fff; color: #000; }
      .header { text-align: center; margin-bottom: 30px; border-bottom: 2px solid #333; padding-bottom: 15px; }
      .header h1 { margin: 0 0 5px; font-size: 20px; }
      .header p { margin: 0; color: #666; font-size: 14px; }
      .photo-item { page-break-inside: avoid; margin-bottom: 25px; border: 1px solid #ddd; border-radius: 8px; padding: 15px; }
      .photo-item h3 { margin: 0 0 4px; font-size: 15px; font-weight: 700; }
      .photo-item .concepto { margin: 0 0 10px; font-size: 13px; color: #555; }
      .photo-item img { max-width: 100%; max-height: 600px; display: block; margin: 0 auto; border-radius: 4px; }
      .total { text-align: center; margin: 20px 0 60px; font-size: 13px; color: #666; }
      .action-bar { position: fixed; bottom: 0; left: 0; right: 0; background: #222; padding: 12px 20px; display: flex; gap: 10px; justify-content: center; z-index: 999; }
      .action-bar button { padding: 8px 20px; border: none; border-radius: 6px; font-size: 14px; cursor: pointer; font-weight: 600; }
      .btn-back { background: #555; color: #fff; }
      .btn-pdf { background: #3b82f6; color: #fff; }
    </style></head><body>
      <div class="header">
        <h1>${title}</h1>
        <p>${subtitle}</p>
      </div>
      ${photos.map((img, i) => `
        <div class="photo-item">
          <h3>${i + 1}. ${img.comercio || "Sin comercio"}</h3>
          <p class="concepto">${img.concepto || "Sin concepto"}</p>
          <img src="${img.url}" alt="Foto ${i + 1}" />
        </div>
      `).join("")}
      <div class="total">Total de fotos: ${photos.length}</div>
      <div class="action-bar no-print">
        <button class="btn-back" onclick="window.close()">← Volver</button>
        <button class="btn-pdf" onclick="window.print()">📄 Guardar PDF</button>
      </div>
    </body></html>`;
    printWindow.document.write(html);
    printWindow.document.close();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl max-h-[90vh] flex flex-col p-0">
        <DialogHeader className="px-6 pt-6 pb-2">
          <DialogTitle className="text-lg">{title}</DialogTitle>
          <p className="text-sm text-muted-foreground">{subtitle}</p>
        </DialogHeader>
        <div className="px-6 pb-2 flex justify-end">
          <Button size="sm" variant="outline" onClick={handlePrint}>
            <Download className="h-4 w-4 mr-2" />
            Guardar PDF
          </Button>
        </div>
        <ScrollArea className="flex-1 px-6 pb-6 max-h-[calc(90vh-140px)]">
          <div className="space-y-4">
            {photos.map((img, i) => (
              <div key={i} className="border border-border rounded-lg p-4">
                <h3 className="font-bold text-sm">{i + 1}. {img.comercio || "Sin comercio"}</h3>
                <p className="text-xs text-muted-foreground mb-3">{img.concepto || "Sin concepto"}</p>
                <img
                  src={img.url}
                  alt={`Foto ${i + 1}`}
                  className="max-w-full max-h-[500px] rounded-md mx-auto block"
                />
              </div>
            ))}
            <p className="text-center text-xs text-muted-foreground pt-2">
              Total de fotos: {photos.length}
            </p>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
