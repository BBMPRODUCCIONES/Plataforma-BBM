import { useState, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Upload, FileText, Download, Trash2, X, File, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Attachment } from "@/types";

interface CotizacionesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  proveedorId: string;
  proveedorNombre: string;
  cotizaciones: Attachment[];
  onCotizacionesChange: (cotizaciones: Attachment[]) => void;
}

export function CotizacionesDialog({
  open,
  onOpenChange,
  proveedorId,
  proveedorNombre,
  cotizaciones,
  onCotizacionesChange,
}: CotizacionesDialogProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const files = Array.from(e.dataTransfer.files);
    await uploadFiles(files);
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const files = Array.from(e.target.files);
      await uploadFiles(files);
    }
  };

  const uploadFiles = async (files: File[]) => {
    if (files.length === 0) return;
    
    setIsUploading(true);
    const newAttachments: Attachment[] = [];

    try {
      for (const file of files) {
        const timestamp = Date.now();
        const sanitizedName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
        const filePath = `${proveedorId}/${timestamp}_${sanitizedName}`;

        const { error: uploadError } = await supabase.storage
          .from('supplier-cotizaciones')
          .upload(filePath, file);

        if (uploadError) {
          console.error('Upload error:', uploadError);
          toast.error(`Error al subir ${file.name}`);
          continue;
        }

        const { data: urlData } = supabase.storage
          .from('supplier-cotizaciones')
          .getPublicUrl(filePath);

        newAttachments.push({
          id: `${timestamp}-${Math.random().toString(36).substr(2, 9)}`,
          name: file.name,
          url: urlData.publicUrl,
          type: file.type,
          size: file.size,
          uploadedAt: new Date().toISOString(),
        });
      }

      if (newAttachments.length > 0) {
        const updatedCotizaciones = [...cotizaciones, ...newAttachments];
        onCotizacionesChange(updatedCotizaciones);
        toast.success(`${newAttachments.length} archivo(s) subido(s) correctamente`);
      }
    } catch (error) {
      console.error('Error uploading files:', error);
      toast.error('Error al subir archivos');
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleDelete = async (attachment: Attachment) => {
    try {
      // Extract file path from URL
      const urlParts = attachment.url.split('/supplier-cotizaciones/');
      if (urlParts.length > 1) {
        const filePath = decodeURIComponent(urlParts[1]);
        await supabase.storage.from('supplier-cotizaciones').remove([filePath]);
      }

      const updatedCotizaciones = cotizaciones.filter(c => c.id !== attachment.id);
      onCotizacionesChange(updatedCotizaciones);
      toast.success('Archivo eliminado');
    } catch (error) {
      console.error('Error deleting file:', error);
      toast.error('Error al eliminar archivo');
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const getFileIcon = (type: string) => {
    if (type.includes('pdf')) return '📄';
    if (type.includes('image')) return '🖼️';
    if (type.includes('word') || type.includes('document')) return '📝';
    if (type.includes('excel') || type.includes('spreadsheet')) return '📊';
    return '📎';
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="text-lg font-semibold">
            Cotizaciones - {proveedorNombre}
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-4">
          {/* Upload Zone */}
          <div
            className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors cursor-pointer ${
              isDragging
                ? 'border-primary bg-primary/10'
                : 'border-border hover:border-primary/50'
            }`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
          >
            <input
              ref={fileInputRef}
              type="file"
              multiple
              className="hidden"
              onChange={handleFileSelect}
            />
            {isUploading ? (
              <div className="flex flex-col items-center gap-2">
                <Loader2 className="h-10 w-10 text-primary animate-spin" />
                <p className="text-sm text-muted-foreground">Subiendo archivos...</p>
              </div>
            ) : (
              <>
                <Upload className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
                <p className="text-sm font-medium">
                  Arrastra archivos aquí o haz clic para seleccionar
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  PDF, Word, Excel, imágenes y más
                </p>
              </>
            )}
          </div>

          {/* File List */}
          {cotizaciones.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-sm font-medium text-muted-foreground">
                Archivos adjuntos ({cotizaciones.length})
              </h4>
              <div className="space-y-2">
                {cotizaciones.map((attachment) => (
                  <div
                    key={attachment.id}
                    className="flex items-center justify-between p-3 bg-muted/50 rounded-lg border border-border"
                  >
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <span className="text-xl">{getFileIcon(attachment.type)}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{attachment.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatFileSize(attachment.size)}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => window.open(attachment.url, '_blank')}
                      >
                        <Download className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:text-destructive"
                        onClick={() => handleDelete(attachment)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {cotizaciones.length === 0 && !isUploading && (
            <p className="text-center text-sm text-muted-foreground py-4">
              No hay archivos adjuntos
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
