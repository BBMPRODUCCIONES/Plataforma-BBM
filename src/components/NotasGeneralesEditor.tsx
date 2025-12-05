import React, { useState, useRef, useEffect } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { X, Image as ImageIcon, Loader2 } from "lucide-react";

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
}

export const NotasGeneralesEditor: React.FC<NotasGeneralesEditorProps> = ({
  value,
  images,
  onChange,
  onImagesChange,
  onBlur,
  placeholder = "Escriba notas generales del evento...",
  className = "",
}) => {
  const [isUploading, setIsUploading] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handlePaste = async (e: React.ClipboardEvent) => {
    console.log("[NotasGeneralesEditor] Paste event triggered");
    const items = e.clipboardData?.items;
    if (!items) {
      console.log("[NotasGeneralesEditor] No clipboard items found");
      return;
    }

    console.log("[NotasGeneralesEditor] Clipboard items count:", items.length);
    for (const item of items) {
      console.log("[NotasGeneralesEditor] Item type:", item.type);
      if (item.type.startsWith("image/")) {
        e.preventDefault();
        const file = item.getAsFile();
        if (file) {
          console.log("[NotasGeneralesEditor] Image file detected:", file.name, file.type, file.size);
          await uploadImage(file);
        } else {
          console.log("[NotasGeneralesEditor] Could not get file from clipboard item");
        }
        return;
      }
    }
    console.log("[NotasGeneralesEditor] No image found in clipboard items");
  };

  const uploadImage = async (file: File) => {
    console.log("[NotasGeneralesEditor] Starting upload for:", file.name, file.type, file.size);
    
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
    
    console.log("[NotasGeneralesEditor] User authenticated:", session.user.id);
    
    setIsUploading(true);
    try {
      const fileExt = file.name.split(".").pop() || "png";
      const fileName = `${crypto.randomUUID()}.${fileExt}`;
      const filePath = `notes/${fileName}`;

      console.log("[NotasGeneralesEditor] Uploading to path:", filePath);

      const { error: uploadError, data: uploadData } = await supabase.storage
        .from("notes-images")
        .upload(filePath, file);

      if (uploadError) {
        console.error("[NotasGeneralesEditor] Upload error:", uploadError);
        toast.error(`Error al subir: ${uploadError.message}`);
        return;
      }

      console.log("[NotasGeneralesEditor] Upload successful:", uploadData);

      const { data: urlData } = supabase.storage
        .from("notes-images")
        .getPublicUrl(filePath);

      console.log("[NotasGeneralesEditor] Public URL:", urlData.publicUrl);

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
          onPaste={handlePaste}
          onBlur={onBlur}
          placeholder={placeholder}
          className="min-h-[80px] text-sm"
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
                className="absolute top-1 right-1 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
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
