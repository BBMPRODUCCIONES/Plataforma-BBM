import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { FileImage, Upload, Trash2, Loader2, Eye, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface CertificadoBancarioUploadProps {
  proveedorId: string;
  proveedorNombre: string;
  certificadoUrl: string | null;
  onCertificadoChange: (url: string | null) => void;
  disabled?: boolean;
}

export function CertificadoBancarioUpload({
  proveedorId,
  proveedorNombre,
  certificadoUrl,
  onCertificadoChange,
  disabled = false,
}: CertificadoBancarioUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type (images only)
    if (!file.type.startsWith("image/")) {
      toast.error("Solo se permiten imágenes");
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error("El archivo no puede superar 5MB");
      return;
    }

    setUploading(true);
    try {
      // Delete old file if exists
      if (certificadoUrl) {
        const oldPath = certificadoUrl.split("/").slice(-2).join("/");
        await supabase.storage.from("supplier-certificates").remove([oldPath]);
      }

      // Upload new file
      const fileExt = file.name.split(".").pop();
      const fileName = `${proveedorId}/certificado-bancario.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from("supplier-certificates")
        .upload(fileName, file, { upsert: true });

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: urlData } = supabase.storage
        .from("supplier-certificates")
        .getPublicUrl(fileName);

      onCertificadoChange(urlData.publicUrl);
      toast.success("Certificado bancario subido exitosamente");
    } catch (err) {
      console.error("[CertificadoBancarioUpload] Error:", err);
      toast.error("Error al subir el certificado");
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleDelete = async () => {
    if (!certificadoUrl) return;

    setDeleting(true);
    try {
      const filePath = certificadoUrl.split("/").slice(-2).join("/");
      await supabase.storage.from("supplier-certificates").remove([filePath]);
      onCertificadoChange(null);
      toast.success("Certificado eliminado");
    } catch (err) {
      console.error("[CertificadoBancarioUpload] Delete error:", err);
      toast.error("Error al eliminar el certificado");
    } finally {
      setDeleting(false);
    }
  };

  const hasCertificado = !!certificadoUrl;

  return (
    <>
      <div className="flex items-center gap-1">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleUpload}
          className="hidden"
          disabled={disabled || uploading}
        />

        {hasCertificado ? (
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs text-primary"
              onClick={(e) => {
                e.stopPropagation();
                setPreviewOpen(true);
              }}
              disabled={uploading || deleting}
            >
              <Eye className="h-3 w-3 mr-1" />
              Ver
            </Button>
            {!disabled && (
              <>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-xs"
                  onClick={(e) => {
                    e.stopPropagation();
                    fileInputRef.current?.click();
                  }}
                  disabled={uploading || deleting}
                >
                  {uploading ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <Upload className="h-3 w-3" />
                  )}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-xs text-destructive hover:text-destructive"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDelete();
                  }}
                  disabled={uploading || deleting}
                >
                  {deleting ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <Trash2 className="h-3 w-3" />
                  )}
                </Button>
              </>
            )}
          </div>
        ) : (
          <Button
            variant="outline"
            size="sm"
            className={cn(
              "h-7 px-2 text-xs",
              disabled && "opacity-50 cursor-not-allowed"
            )}
            onClick={(e) => {
              e.stopPropagation();
              if (!disabled) fileInputRef.current?.click();
            }}
            disabled={disabled || uploading}
          >
            {uploading ? (
              <Loader2 className="h-3 w-3 mr-1 animate-spin" />
            ) : (
              <FileImage className="h-3 w-3 mr-1" />
            )}
            Subir
          </Button>
        )}
      </div>

      {/* Preview Dialog */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Certificado Bancario - {proveedorNombre}</DialogTitle>
          </DialogHeader>
          <div className="relative flex items-center justify-center max-h-[70vh] overflow-auto">
            {certificadoUrl && (
              <img
                src={certificadoUrl}
                alt={`Certificado bancario de ${proveedorNombre}`}
                className="max-w-full h-auto rounded-md"
              />
            )}
          </div>
          <div className="flex justify-end gap-2 mt-4">
            <Button
              variant="outline"
              size="sm"
              onClick={() => window.open(certificadoUrl || "", "_blank")}
            >
              Abrir en nueva pestaña
            </Button>
            <Button variant="outline" size="sm" onClick={() => setPreviewOpen(false)}>
              Cerrar
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

export default CertificadoBancarioUpload;
