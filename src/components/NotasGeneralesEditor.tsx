import React, { useState, useRef, useEffect } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { X, Image as ImageIcon, Loader2 } from "lucide-react";
import { logger } from "@/lib/logger";

interface NotasImage {
  id: string;
  url: string;
  name: string;
}

interface NotasGeneralesEditorProps {
  value: string;
  images: NotasImage[];
  onChange: (value: string) => void;
  onImagesChange: (images: NotasImage[]) => void;
  onBlur?: () => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

export const NotasGeneralesEditor: React.FC<NotasGeneralesEditorProps> = ({
  value,
  images,
  onChange,
  onImagesChange,
  onBlur,
  placeholder = "Escriba notas generales del evento...",
  className = "",
  disabled = false,
}) => {
  const [isUploading, setIsUploading] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handlePaste = async (e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) {
      return;
    }

    for (const item of items) {
      if (item.type.startsWith("image/")) {
        e.preventDefault();
        const file = item.getAsFile();
        if (file) {
          logger.debug("[NotasGeneralesEditor] Image file detected:", file.name, file.type, file.size);
          await uploadImage(file);
        }
        return;
      }
    }
  };

  const uploadImage = async (file: File) => {
    // Verificar autenticación primero
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    if (sessionError) {
      console.error("[NotasGeneralesEditor] Session error:", sessionError);
      toast.error("Error de sesión. Por favor recargue la página.");
      return;
    }
    
    if (!session) {
      console.error("[NotasGeneralesEditor] User not authenticated");
      toast.error("Debe iniciar sesión para subir imágenes");
      return;
    }
    
    setIsUploading(true);
    try {
      const fileExt = file.name.split(".").pop() || "png";
      const fileName = `${crypto.randomUUID()}.${fileExt}`;
      const filePath = `notes/${fileName}`;

      const { error: uploadError, data: uploadData } = await supabase.storage
        .from("notes-images")
        .upload(filePath, file);

      if (uploadError) {
        console.error("[NotasGeneralesEditor] Upload error:", uploadError);
        toast.error(`Error al subir: ${uploadError.message}`);
        return;
      }

      logger.debug("[NotasGeneralesEditor] Upload successful:", uploadData);

      const { data: urlData } = supabase.storage
        .from("notes-images")
        .getPublicUrl(filePath);

      const newImage: NotasImage = {
        id: crypto.randomUUID(),
        url: urlData.publicUrl,
        name: file.name || fileName,
      };

      onImagesChange([...images, newImage]);
      toast.success("Imagen pegada correctamente");
    } catch (error) {
      console.error("[NotasGeneralesEditor] Error uploading image:", error);
      toast.error("Error al subir la imagen");
    } finally {
      setIsUploading(false);
    }
  };

  const removeImage = (imageId: string) => {
    onImagesChange(images.filter((img) => img.id !== imageId));
  };

  return (
    <div className={`space-y-3 ${className}`}>
      <div className="relative">
        <Textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onPaste={disabled ? undefined : handlePaste}
          onBlur={onBlur}
          placeholder={placeholder}
          className="min-h-[80px] text-sm"
          disabled={disabled}
        />
        {isUploading && (
          <div className="absolute inset-0 bg-background/80 flex items-center justify-center rounded-md">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
            <span className="ml-2 text-sm">Subiendo imagen...</span>
          </div>
        )}
      </div>

      {images.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {images.map((img) => (
            <div
              key={img.id}
              className="relative group rounded-md overflow-hidden border border-border bg-muted/30"
            >
              <img
                src={img.url}
                alt={img.name}
                className="w-full h-24 object-cover cursor-pointer"
                onClick={() => window.open(img.url, "_blank")}
              />
              <Button
                variant="destructive"
                size="icon"
                className="absolute top-1 right-1 h-9 w-9 md:h-6 md:w-6 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity"
                onClick={() => removeImage(img.id)}
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
          ))}
        </div>
      )}

      <p className="text-[10px] text-muted-foreground flex items-center gap-1">
        <ImageIcon className="h-3 w-3" />
        Puede pegar imágenes directamente (Ctrl+V). Las notas están sincronizadas en todos los paneles.
      </p>
    </div>
  );
};
