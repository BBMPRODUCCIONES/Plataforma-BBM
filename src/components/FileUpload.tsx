import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Attachment } from "@/types";
import { FileIcon, Upload, X, Eye, Download, Paperclip } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";

interface FileUploadProps {
  attachments: Attachment[];
  onAttachmentsChange: (attachments: Attachment[]) => void;
  multiple?: boolean;
  acceptedTypes?: string;
  maxSize?: number; // in MB
  className?: string;
  disabled?: boolean;
}

export function FileUpload({
  attachments,
  onAttachmentsChange,
  multiple = true,
  acceptedTypes = "*",
  maxSize = 10,
  className,
  disabled = false,
}: FileUploadProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const handleFileSelect = (files: FileList | null) => {
    if (!files || files.length === 0) return;

    const newAttachments: Attachment[] = [];

    Array.from(files).forEach((file) => {
      // Check file size
      if (file.size > maxSize * 1024 * 1024) {
        toast({
          title: "Archivo muy grande",
          description: `${file.name} excede el límite de ${maxSize}MB`,
          variant: "destructive",
        });
        return;
      }

      // Create attachment
      const attachment: Attachment = {
        id: `file-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        name: file.name,
        url: URL.createObjectURL(file),
        type: file.type,
        size: file.size,
        uploadedAt: new Date().toISOString(),
      };

      newAttachments.push(attachment);
    });

    if (newAttachments.length > 0) {
      if (multiple) {
        onAttachmentsChange([...attachments, ...newAttachments]);
      } else {
        onAttachmentsChange(newAttachments.slice(0, 1));
      }

      toast({
        title: "Archivos adjuntados",
        description: `${newAttachments.length} archivo(s) agregado(s)`,
      });
    }
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

  const removeAttachment = (id: string) => {
    onAttachmentsChange(attachments.filter((a) => a.id !== id));
  };

  const getFileIcon = (type: string) => {
    if (type.startsWith("image/")) return "🖼️";
    if (type.includes("pdf")) return "📄";
    if (type.includes("excel") || type.includes("spreadsheet")) return "📊";
    if (type.includes("word") || type.includes("document")) return "📝";
    return "📎";
  };

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return "";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className={cn("space-y-2", className)}>
      {/* Drop Zone */}
      <div
        className={cn(
          "border-2 border-dashed rounded-lg p-4 text-center transition-colors cursor-pointer",
          isDragging ? "border-primary bg-primary/5" : "border-border hover:border-primary/50",
          disabled && "opacity-50 pointer-events-none"
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
          disabled={disabled}
        />
        <Upload className="h-6 w-6 mx-auto mb-2 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">
          {isDragging
            ? "Suelta los archivos aquí"
            : "Arrastra archivos aquí o haz clic para seleccionar"}
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          {multiple ? "Múltiples archivos permitidos" : "Un archivo"} • Máx {maxSize}MB
        </p>
      </div>

      {/* Attachments List */}
      {attachments.length > 0 && (
        <div className="space-y-1">
          {attachments.map((attachment) => (
            <div
              key={attachment.id}
              className="flex items-center gap-2 p-2 bg-muted/50 rounded-md group"
            >
              <span className="text-lg">{getFileIcon(attachment.type)}</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{attachment.name}</p>
                <p className="text-xs text-muted-foreground">
                  {formatFileSize(attachment.size)}
                </p>
              </div>
              {/* En tactil no existe :hover: los botones deben verse siempre.
                  El efecto de aparecer al pasar el mouse queda solo en escritorio. */}
              <div className="flex items-center gap-1 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={(e) => {
                    e.stopPropagation();
                    window.open(attachment.url, "_blank");
                  }}
                >
                  <Eye className="h-3 w-3" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={(e) => {
                    e.stopPropagation();
                    const a = document.createElement("a");
                    a.href = attachment.url;
                    a.download = attachment.name;
                    a.click();
                  }}
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
                      removeAttachment(attachment.id);
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

// Compact button version for table cells
export function FileUploadButton({
  attachments,
  onAttachmentsChange,
  multiple = true,
  disabled = false,
}: Omit<FileUploadProps, "className" | "acceptedTypes" | "maxSize">) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (files: FileList | null) => {
    if (!files || files.length === 0) return;

    const newAttachments: Attachment[] = [];

    Array.from(files).forEach((file) => {
      if (file.size > 10 * 1024 * 1024) {
        toast({
          title: "Archivo muy grande",
          description: `${file.name} excede el límite de 10MB`,
          variant: "destructive",
        });
        return;
      }

      const attachment: Attachment = {
        id: `file-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        name: file.name,
        url: URL.createObjectURL(file),
        type: file.type,
        size: file.size,
        uploadedAt: new Date().toISOString(),
      };

      newAttachments.push(attachment);
    });

    if (newAttachments.length > 0) {
      if (multiple) {
        onAttachmentsChange([...attachments, ...newAttachments]);
      } else {
        onAttachmentsChange(newAttachments.slice(0, 1));
      }

      toast({
        title: "Archivos adjuntados",
        description: `${newAttachments.length} archivo(s) agregado(s)`,
      });
    }
  };

  return (
    <div className="flex items-center gap-1">
      <input
        ref={fileInputRef}
        type="file"
        multiple={multiple}
        onChange={(e) => handleFileSelect(e.target.files)}
        className="hidden"
        disabled={disabled}
      />
      <Button
        variant="ghost"
        size="sm"
        className="h-6 px-2 text-xs"
        onClick={() => fileInputRef.current?.click()}
        disabled={disabled}
      >
        <Paperclip className="h-3 w-3 mr-1" />
        {attachments.length || "Adjuntar"}
      </Button>
    </div>
  );
}
