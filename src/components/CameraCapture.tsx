import { useState, useRef, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Camera, X, RotateCcw, Check, Loader2 } from "lucide-react";
import { toast } from "@/hooks/use-toast";

interface CameraCaptureProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCapture: (file: File) => void;
}

export function CameraCapture({ open, onOpenChange, onCapture }: CameraCaptureProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<"user" | "environment">("environment");
  const [hasMultipleCameras, setHasMultipleCameras] = useState(false);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
  }, []);

  const startCamera = useCallback(async () => {
    setIsLoading(true);
    setCapturedImage(null);
    
    try {
      // Check for multiple cameras
      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoDevices = devices.filter(d => d.kind === "videoinput");
      setHasMultipleCameras(videoDevices.length > 1);

      const constraints: MediaStreamConstraints = {
        video: {
          facingMode: facingMode,
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
        audio: false,
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
    } catch (error: any) {
      console.error("Error accessing camera:", error);
      toast({
        title: "Error de cámara",
        description: error.name === "NotAllowedError" 
          ? "Permiso de cámara denegado. Por favor habilita el acceso a la cámara."
          : "No se pudo acceder a la cámara del dispositivo.",
        variant: "destructive",
      });
      onOpenChange(false);
    } finally {
      setIsLoading(false);
    }
  }, [facingMode, onOpenChange]);

  useEffect(() => {
    if (open) {
      startCamera();
    } else {
      stopCamera();
      setCapturedImage(null);
    }

    return () => {
      stopCamera();
    };
  }, [open, startCamera, stopCamera]);

  const switchCamera = () => {
    stopCamera();
    setFacingMode(prev => prev === "user" ? "environment" : "user");
  };

  useEffect(() => {
    if (open && !capturedImage) {
      startCamera();
    }
  }, [facingMode]);

  const takePhoto = () => {
    if (!videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    
    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const imageData = canvas.toDataURL("image/jpeg", 0.9);
      setCapturedImage(imageData);
      stopCamera();
    }
  };

  const retakePhoto = () => {
    setCapturedImage(null);
    startCamera();
  };

  const confirmPhoto = async () => {
    if (!capturedImage) return;

    try {
      // Convert base64 to File
      const response = await fetch(capturedImage);
      const blob = await response.blob();
      const fileName = `foto_${Date.now()}.jpg`;
      const file = new File([blob], fileName, { type: "image/jpeg" });
      
      onCapture(file);
      onOpenChange(false);
    } catch (error) {
      console.error("Error converting image:", error);
      toast({
        title: "Error",
        description: "No se pudo procesar la imagen",
        variant: "destructive",
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg p-0 overflow-hidden">
        <DialogHeader className="p-4 pb-0">
          <DialogTitle className="flex items-center gap-2">
            <Camera className="h-5 w-5" />
            Tomar Foto
          </DialogTitle>
        </DialogHeader>
        
        <div className="relative bg-black aspect-[4/3] w-full">
          {isLoading && (
            <div className="absolute inset-0 flex items-center justify-center bg-muted">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          )}
          
          {capturedImage ? (
            <img 
              src={capturedImage} 
              alt="Foto capturada" 
              className="w-full h-full object-contain"
            />
          ) : (
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-contain"
            />
          )}
          
          <canvas ref={canvasRef} className="hidden" />
        </div>
        
        <div className="p-4 flex items-center justify-center gap-4">
          {capturedImage ? (
            <>
              <Button
                variant="outline"
                size="lg"
                onClick={retakePhoto}
                className="gap-2"
              >
                <RotateCcw className="h-5 w-5" />
                Repetir
              </Button>
              <Button
                size="lg"
                onClick={confirmPhoto}
                className="gap-2"
              >
                <Check className="h-5 w-5" />
                Usar Foto
              </Button>
            </>
          ) : (
            <>
              {hasMultipleCameras && (
                <Button
                  variant="outline"
                  size="icon"
                  onClick={switchCamera}
                  disabled={isLoading}
                  title="Cambiar cámara"
                >
                  <RotateCcw className="h-5 w-5" />
                </Button>
              )}
              <Button
                size="lg"
                onClick={takePhoto}
                disabled={isLoading}
                className="rounded-full w-16 h-16"
              >
                <Camera className="h-8 w-8" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                onClick={() => onOpenChange(false)}
                title="Cancelar"
              >
                <X className="h-5 w-5" />
              </Button>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// Hook to check if camera is available
export function useCameraAvailable() {
  const [hasCamera, setHasCamera] = useState<boolean | null>(null);

  useEffect(() => {
    async function checkCamera() {
      try {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          setHasCamera(false);
          return;
        }
        
        const devices = await navigator.mediaDevices.enumerateDevices();
        const hasVideoInput = devices.some(device => device.kind === "videoinput");
        setHasCamera(hasVideoInput);
      } catch {
        setHasCamera(false);
      }
    }
    
    checkCamera();
  }, []);

  return hasCamera;
}
