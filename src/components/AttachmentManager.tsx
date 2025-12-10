import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Attachment } from "@/types";
import { Upload, X, Eye, Download, Paperclip, Loader2, FileText, Image, FileSpreadsheet, File, Camera } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

const BUCKET_NAME = "project-attachments";

interface AttachmentManagerProps {
  attachments: Attachment[];
  onAttachmentsChange: (attachments: Attachment[]) => void;
  multiple?: boolean;
  acceptedTypes?: string;
  maxSize?: number;
  className?: string;
  disabled?: boolean;
  projectId?: string;
  fieldName?: string;
}

export function AttachmentManager({
  attachments,
  onAttachmentsChange,
  multiple = true,
  acceptedTypes = "*",
  maxSize = 10,
  className,
  disabled = false,
  projectId = "general",
  fieldName = "attachments",
}: AttachmentManagerProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [loadingUrls, setLoadingUrls] = useState<Record<string, boolean>>({});

  const uploadToStorage = async (file: File): Promise<Attachment | null> => {
    try {
      const fileExt = file.name.split(".").pop() || "bin";
      const fileName = `${crypto.randomUUID()}.${fileExt}`;
      const filePath = `${projectId}/${fieldName}/${fileName}`;

      const { error: uploadError, data } = await supabase.storage
        .from(BUCKET_NAME)
        .upload(filePath, file);

      if (uploadError) {
        console.error("Upload error:", uploadError);
        toast({
          title: "Error al subir",
          description: uploadError.message,
          variant: "destructive",
        });
        return null;
      }

      return {
        id: crypto.randomUUID(),
        name: file.name,
        url: "", // Will be populated with signed URL when viewing
        type: file.type,
        size: file.size,
        uploadedAt: new Date().toISOString(),
        filePath: filePath,
        bucket: BUCKET_NAME,
      };
    } catch (error) {
      console.error("Error uploading file:", error);
      return null;
    }
  };

  const getSignedUrl = async (attachment: Attachment): Promise<string | null> => {
    if (!attachment.filePath || !attachment.bucket) {
      return attachment.url || null;
    }

    try {
      const { data, error } = await supabase.functions.invoke("get-signed-url", {
        body: {
          bucket: attachment.bucket,
          path: attachment.filePath,
          expiresIn: 3600,
        },
      });

      if (error || !data?.signedUrl) {
        console.error("Error getting signed URL:", error);
        return null;
      }

      return data.signedUrl;
    } catch (error) {
      console.error("Error invoking get-signed-url:", error);
      return null;
    }
  };

  const handleFileSelect = async (files: FileList | null) => {
    if (!files || files.length === 0) return;

    setIsUploading(true);
    const newAttachments: Attachment[] = [];

    for (const file of Array.from(files)) {
      if (file.size > maxSize * 1024 * 1024) {
        toast({
          title: "Archivo muy grande",
          description: `${file.name} excede el límite de ${maxSize}MB`,
          variant: "destructive",
        });
        continue;
      }

      const attachment = await uploadToStorage(file);
      if (attachment) {
        newAttachments.push(attachment);
      }
    }

    if (newAttachments.length > 0) {
      if (multiple) {
        onAttachmentsChange([...attachments, ...newAttachments]);
      } else {
        onAttachmentsChange(newAttachments.slice(0, 1));
      }

      toast({
        title: "Archivos subidos",
        description: `${newAttachments.length} archivo(s) guardado(s)`,
      });
    }

    setIsUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    handleFileSelect(e.dataTransfer.files);
  };

  const removeAttachment = async (attachment: Attachment) => {
    if (attachment.filePath && attachment.bucket) {
      const { error } = await supabase.storage
        .from(attachment.bucket)
        .remove([attachment.filePath]);

      if (error) {
        console.error("Error removing file:", error);
      }
    }
    onAttachmentsChange(attachments.filter((a) => a.id !== attachment.id));
  };

  const viewAttachment = async (attachment: Attachment) => {
    setLoadingUrls((prev) => ({ ...prev, [attachment.id]: true }));
    const url = await getSignedUrl(attachment);
    setLoadingUrls((prev) => ({ ...prev, [attachment.id]: false }));

    if (url) {
      window.open(url, "_blank");
    } else {
      toast({
        title: "Error",
        description: "No se pudo obtener el archivo",
        variant: "destructive",
      });
    }
  };

  const downloadAttachment = async (attachment: Attachment) => {
    setLoadingUrls((prev) => ({ ...prev, [attachment.id]: true }));
    const url = await getSignedUrl(attachment);
    setLoadingUrls((prev) => ({ ...prev, [attachment.id]: false }));

    if (url) {
      const a = document.createElement("a");
      a.href = url;
      a.download = attachment.name;
      a.click();
    } else {
      toast({
        title: "Error",
        description: "No se pudo descargar el archivo",
        variant: "destructive",
      });
    }
  };

  const getFileIcon = (type: string) => {
    if (type.startsWith("image/")) return <Image className="h-4 w-4 text-blue-500" />;
    if (type.includes("pdf")) return <FileText className="h-4 w-4 text-red-500" />;
    if (type.includes("excel") || type.includes("spreadsheet")) return <FileSpreadsheet className="h-4 w-4 text-green-500" />;
    return <File className="h-4 w-4 text-muted-foreground" />;
  };

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return "";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className={cn("space-y-2", className)}>
      <div
        className={cn(
          "border-2 border-dashed rounded-lg p-4 text-center transition-colors cursor-pointer",
          isDragging ? "border-primary bg-primary/5" : "border-border hover:border-primary/50",
          (disabled || isUploading) && "opacity-50 pointer-events-none"
        )}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple={multiple}
          accept={acceptedTypes}
          onChange={(e) => handleFileSelect(e.target.files)}
          className="hidden"
          disabled={disabled || isUploading}
        />
        {isUploading ? (
          <>
            <Loader2 className="h-6 w-6 mx-auto mb-2 text-primary animate-spin" />
            <p className="text-sm text-muted-foreground">Subiendo archivos...</p>
          </>
        ) : (
          <>
            <Upload className="h-6 w-6 mx-auto mb-2 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              {isDragging ? "Suelta los archivos aquí" : "Arrastra archivos o haz clic"}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {multiple ? "Múltiples archivos" : "Un archivo"} • Máx {maxSize}MB
            </p>
          </>
        )}
      </div>

      {attachments.length > 0 && (
        <div className="space-y-1">
          {attachments.map((attachment) => (
            <div
              key={attachment.id}
              className="flex items-center gap-2 p-2 bg-muted/50 rounded-md group"
            >
              {getFileIcon(attachment.type)}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{attachment.name}</p>
                <p className="text-xs text-muted-foreground">
                  {formatFileSize(attachment.size)}
                </p>
              </div>
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={(e) => {
                    e.stopPropagation();
                    viewAttachment(attachment);
                  }}
                  disabled={loadingUrls[attachment.id]}
                >
                  {loadingUrls[attachment.id] ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <Eye className="h-3 w-3" />
                  )}
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={(e) => {
                    e.stopPropagation();
                    downloadAttachment(attachment);
                  }}
                  disabled={loadingUrls[attachment.id]}
                >
                  <Download className="h-3 w-3" />
                </Button>
                {!disabled && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-destructive"
                    onClick={(e) => {
                      e.stopPropagation();
                      removeAttachment(attachment);
                    }}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// Compact button version for table cells with view dialog
export function AttachmentButton({
  attachments,
  onAttachmentsChange,
  multiple = true,
  disabled = false,
  projectId = "general",
  fieldName = "attachments",
  label = "Adjuntar",
  enableCamera = false,
}: Omit<AttachmentManagerProps, "className" | "acceptedTypes" | "maxSize"> & { label?: string; enableCamera?: boolean }) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [loadingUrls, setLoadingUrls] = useState<Record<string, boolean>>({});

  const uploadToStorage = async (file: File): Promise<Attachment | null> => {
    try {
      const fileExt = file.name.split(".").pop() || "bin";
      const fileName = `${crypto.randomUUID()}.${fileExt}`;
      const filePath = `${projectId}/${fieldName}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from(BUCKET_NAME)
        .upload(filePath, file);

      if (uploadError) {
        console.error("Upload error:", uploadError);
        return null;
      }

      return {
        id: crypto.randomUUID(),
        name: file.name,
        url: "",
        type: file.type,
        size: file.size,
        uploadedAt: new Date().toISOString(),
        filePath: filePath,
        bucket: BUCKET_NAME,
      };
    } catch (error) {
      console.error("Error uploading file:", error);
      return null;
    }
  };

  const getSignedUrl = async (attachment: Attachment): Promise<string | null> => {
    if (!attachment.filePath || !attachment.bucket) {
      return attachment.url || null;
    }

    try {
      const { data, error } = await supabase.functions.invoke("get-signed-url", {
        body: {
          bucket: attachment.bucket,
          path: attachment.filePath,
          expiresIn: 3600,
        },
      });

      if (error || !data?.signedUrl) return null;
      return data.signedUrl;
    } catch {
      return null;
    }
  };

  const handleFileSelect = async (files: FileList | null) => {
    if (!files || files.length === 0) return;

    setIsUploading(true);
    const newAttachments: Attachment[] = [];

    for (const file of Array.from(files)) {
      if (file.size > 10 * 1024 * 1024) {
        toast({
          title: "Archivo muy grande",
          description: `${file.name} excede el límite de 10MB`,
          variant: "destructive",
        });
        continue;
      }

      const attachment = await uploadToStorage(file);
      if (attachment) {
        newAttachments.push(attachment);
      }
    }

    if (newAttachments.length > 0) {
      if (multiple) {
        onAttachmentsChange([...attachments, ...newAttachments]);
      } else {
        onAttachmentsChange(newAttachments.slice(0, 1));
      }

      toast({
        title: "Archivos subidos",
        description: `${newAttachments.length} archivo(s) guardado(s)`,
      });
    }

    setIsUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const removeAttachment = async (attachment: Attachment) => {
    if (attachment.filePath && attachment.bucket) {
      await supabase.storage.from(attachment.bucket).remove([attachment.filePath]);
    }
    onAttachmentsChange(attachments.filter((a) => a.id !== attachment.id));
  };

  const viewAttachment = async (attachment: Attachment) => {
    setLoadingUrls((prev) => ({ ...prev, [attachment.id]: true }));
    const url = await getSignedUrl(attachment);
    setLoadingUrls((prev) => ({ ...prev, [attachment.id]: false }));

    if (url) {
      window.open(url, "_blank");
    } else {
      toast({ title: "Error", description: "No se pudo obtener el archivo", variant: "destructive" });
    }
  };

  const downloadAttachment = async (attachment: Attachment) => {
    setLoadingUrls((prev) => ({ ...prev, [attachment.id]: true }));
    const url = await getSignedUrl(attachment);
    setLoadingUrls((prev) => ({ ...prev, [attachment.id]: false }));

    if (url) {
      const a = document.createElement("a");
      a.href = url;
      a.download = attachment.name;
      a.click();
    }
  };

  const getFileIcon = (type: string) => {
    if (type.startsWith("image/")) return <Image className="h-4 w-4 text-blue-500" />;
    if (type.includes("pdf")) return <FileText className="h-4 w-4 text-red-500" />;
    if (type.includes("excel") || type.includes("spreadsheet")) return <FileSpreadsheet className="h-4 w-4 text-green-500" />;
    return <File className="h-4 w-4 text-muted-foreground" />;
  };

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return "";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
      <input
        ref={fileInputRef}
        type="file"
        multiple={multiple}
        onChange={(e) => handleFileSelect(e.target.files)}
        className="hidden"
        disabled={disabled || isUploading}
      />
      {enableCamera && (
        <input
          ref={cameraInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          onChange={(e) => handleFileSelect(e.target.files)}
          className="hidden"
          disabled={disabled || isUploading}
        />
      )}
      
      {attachments.length > 0 ? (
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button variant="ghost" size="sm" className="h-6 px-2 text-xs">
              <Paperclip className="h-3 w-3 mr-1" />
              {attachments.length}
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Archivos Adjuntos ({attachments.length})</DialogTitle>
            </DialogHeader>
            <div className="space-y-2 max-h-[400px] overflow-y-auto">
              {attachments.map((attachment) => (
                <div
                  key={attachment.id}
                  className="flex items-center gap-2 p-2 bg-muted/50 rounded-md"
                >
                  {getFileIcon(attachment.type)}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{attachment.name}</p>
                    <p className="text-xs text-muted-foreground">{formatFileSize(attachment.size)}</p>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => viewAttachment(attachment)}
                      disabled={loadingUrls[attachment.id]}
                    >
                      {loadingUrls[attachment.id] ? <Loader2 className="h-3 w-3 animate-spin" /> : <Eye className="h-3 w-3" />}
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => downloadAttachment(attachment)}
                      disabled={loadingUrls[attachment.id]}
                    >
                      <Download className="h-3 w-3" />
                    </Button>
                    {!disabled && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-destructive"
                        onClick={() => removeAttachment(attachment)}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
            <div className="pt-2 border-t flex gap-2">
              <Button
                variant="outline"
                size="sm"
                className="flex-1"
                onClick={() => fileInputRef.current?.click()}
                disabled={disabled || isUploading}
              >
                {isUploading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Subiendo...
                  </>
                ) : (
                  <>
                    <Upload className="h-4 w-4 mr-2" />
                    Agregar archivos
                  </>
                )}
              </Button>
              {enableCamera && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => cameraInputRef.current?.click()}
                  disabled={disabled || isUploading}
                  title="Tomar foto con cámara"
                >
                  <Camera className="h-4 w-4 mr-2" />
                  Cámara
                </Button>
              )}
            </div>
          </DialogContent>
        </Dialog>
      ) : (
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            className="h-6 px-2 text-xs"
            onClick={() => fileInputRef.current?.click()}
            disabled={disabled || isUploading}
          >
            {isUploading ? (
              <>
                <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                Subiendo...
              </>
            ) : (
              <>
                <Paperclip className="h-3 w-3 mr-1" />
                {label}
              </>
            )}
          </Button>
          {enableCamera && (
            <Button
              variant="ghost"
              size="sm"
              className="h-6 px-2 text-xs"
              onClick={() => cameraInputRef.current?.click()}
              disabled={disabled || isUploading}
              title="Tomar foto con cámara"
            >
              <Camera className="h-3 w-3" />
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
