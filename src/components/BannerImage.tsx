import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ImageIcon, Upload, X } from "lucide-react";
import { useUserRole } from "@/hooks/useUserRole";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

interface BannerImageProps {
  imageUrl?: string;
  onImageChange?: (url: string) => void;
}

export function BannerImage({ imageUrl, onImageChange }: BannerImageProps) {
  const { canEditStructure } = useUserRole();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [newImageUrl, setNewImageUrl] = useState(imageUrl || "");
  const [localImage, setLocalImage] = useState<string | null>(imageUrl || null);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const result = event.target?.result as string;
        setLocalImage(result);
        onImageChange?.(result);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleUrlSubmit = () => {
    if (newImageUrl) {
      setLocalImage(newImageUrl);
      onImageChange?.(newImageUrl);
      setIsDialogOpen(false);
    }
  };

  const handleRemoveImage = () => {
    setLocalImage(null);
    setNewImageUrl("");
    onImageChange?.("");
  };

  if (!localImage) {
    if (!canEditStructure()) return null;
    
    return (
      <div className="w-full h-16 bg-muted/50 border-b border-border flex items-center justify-center">
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button variant="ghost" size="sm" className="text-muted-foreground">
              <ImageIcon className="h-4 w-4 mr-2" />
              Agregar Banner
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Configurar Imagen de Banner</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 mt-4">
              <div>
                <label className="text-sm font-medium mb-2 block">Subir Imagen</label>
                <div className="flex items-center gap-2">
                  <Input
                    type="file"
                    accept="image/*"
                    onChange={handleFileUpload}
                    className="flex-1"
                  />
                </div>
              </div>
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-background px-2 text-muted-foreground">o</span>
                </div>
              </div>
              <div>
                <label className="text-sm font-medium mb-2 block">URL de Imagen</label>
                <div className="flex items-center gap-2">
                  <Input
                    placeholder="https://ejemplo.com/imagen.png"
                    value={newImageUrl}
                    onChange={(e) => setNewImageUrl(e.target.value)}
                    className="flex-1"
                  />
                  <Button onClick={handleUrlSubmit} size="sm">
                    <Upload className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  return (
    <div className="relative w-full h-20 bg-muted/50 border-b border-border overflow-hidden group">
      <img
        src={localImage}
        alt="Banner"
        className="w-full h-full object-cover"
      />
      {canEditStructure() && (
        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="secondary" size="sm">
                <ImageIcon className="h-4 w-4 mr-2" />
                Cambiar
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Cambiar Imagen de Banner</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 mt-4">
                <div>
                  <label className="text-sm font-medium mb-2 block">Subir Imagen</label>
                  <Input
                    type="file"
                    accept="image/*"
                    onChange={handleFileUpload}
                  />
                </div>
                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t" />
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-background px-2 text-muted-foreground">o</span>
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium mb-2 block">URL de Imagen</label>
                  <div className="flex items-center gap-2">
                    <Input
                      placeholder="https://ejemplo.com/imagen.png"
                      value={newImageUrl}
                      onChange={(e) => setNewImageUrl(e.target.value)}
                      className="flex-1"
                    />
                    <Button onClick={handleUrlSubmit} size="sm">
                      <Upload className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            </DialogContent>
          </Dialog>
          <Button variant="destructive" size="sm" onClick={handleRemoveImage}>
            <X className="h-4 w-4 mr-2" />
            Quitar
          </Button>
        </div>
      )}
    </div>
  );
}
