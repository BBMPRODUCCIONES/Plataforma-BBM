import { useState, useRef, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Camera, X, RotateCcw, Check, Loader2, SwitchCamera } from "lucide-react";
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
  const [isCheckingCameras, setIsCheckingCameras] = useState(true);
  const [isSwitching, setIsSwitching] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Check for multiple cameras IMMEDIATELY when modal opens (before stream)
  const checkCameraDevices = useCallback(async () => {
    setIsCheckingCameras(true);
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoDevices = devices.filter(d => d.kind === "videoinput");
      // On first call, labels may be empty (no permission yet), but we can count devices
      setHasMultipleCameras(videoDevices.length > 1);
    } catch (error) {
      console.error("Error enumerating devices:", error);
      setHasMultipleCameras(false);
    } finally {
      setIsCheckingCameras(false);
    }
  }, []);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
  }, []);

  const startCamera = useCallback(async (mode: "user" | "environment" = facingMode) => {
    setIsLoading(true);
    setCapturedImage(null);
    
    try {
      // Stop any existing stream first
      stopCamera();

      const constraints: MediaStreamConstraints = {
        video: {
          facingMode: { ideal: mode },
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

      // Re-check devices after permission granted (now we get proper labels)
      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoDevices = devices.filter(d => d.kind === "videoinput");
      setHasMultipleCameras(videoDevices.length > 1);

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
  }, [facingMode, onOpenChange, stopCamera]);

  // Check cameras immediately when modal opens
  useEffect(() => {
    if (open) {
      checkCameraDevices();
      startCamera();
    } else {
      stopCamera();
      setCapturedImage(null);
      setFacingMode("environment"); // Reset to back camera
    }

    return () => {
      stopCamera();
    };
  }, [open]);

  // FIX B: Switch camera IN-PLACE without closing modal
  const switchCamera = useCallback(async () => {
    if (isSwitching || isLoading) return;
    
    setIsSwitching(true);
    const newMode = facingMode === "user" ? "environment" : "user";
    
    try {
      // Stop current stream
      stopCamera();
      
      // Request new stream with opposite facing mode
      const constraints: MediaStreamConstraints = {
        video: {
          facingMode: { ideal: newMode },
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

      setFacingMode(newMode);
    } catch (error) {
      console.error("Error switching camera:", error);
      toast({
        title: "Error",
        description: "No fue posible cambiar cámara",
        variant: "destructive",
      });
      // Try to restore previous camera
      await startCamera(facingMode);
    } finally {
      setIsSwitching(false);
    }
  }, [facingMode, isSwitching, isLoading, stopCamera, startCamera]);

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

  // FIX C: Confirm photo and return to flow without blocking
  const confirmPhoto = async () => {
    if (!capturedImage || isSaving) return;

    setIsSaving(true);
    try {
      // Convert base64 to File
      const response = await fetch(capturedImage);
      const blob = await response.blob();
      const fileName = `foto_${Date.now()}.jpg`;
      const file = new File([blob], fileName, { type: "image/jpeg" });
      
      // Call onCapture (parent handles upload)
      onCapture(file);
      
      // Close modal and return to flow
      onOpenChange(false);
      
      // Show success toast
      toast({
        title: "Foto guardada",
        description: "La foto se ha guardado correctamente",
      });
    } catch (error) {
      console.error("Error converting image:", error);
      toast({
        title: "Error",
        description: "No se pudo procesar la imagen",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  // Handle close without saving
  const handleClose = () => {
    stopCamera();
    setCapturedImage(null);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="camera-capture-dialog sm:max-w-lg p-0 overflow-hidden">
        {/* Header - siempre visible */}
        <div className="camera-capture-header">
          <DialogHeader className="p-4 pb-0 md:pb-0">
            <DialogTitle className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Camera className="h-5 w-5" />
                Tomar Foto
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={handleClose}
                className="md:hidden h-8 w-8"
                title="Cerrar"
              >
                <X className="h-5 w-5" />
              </Button>
            </DialogTitle>
          </DialogHeader>
        </div>
        
        {/* Preview Zone - centrada */}
        <div className="camera-capture-preview">
          {(isLoading || isSwitching) && (
            <div className="absolute inset-0 flex items-center justify-center bg-muted z-10">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          )}
          
          {capturedImage ? (
            <img 
              src={capturedImage} 
              alt="Foto capturada" 
              className="camera-capture-media"
            />
          ) : (
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="camera-capture-media"
            />
          )}
          
          <canvas ref={canvasRef} className="hidden" />
        </div>
        
        {/* Footer con botones - siempre visible */}
        <div className="camera-capture-footer">
          {capturedImage ? (
            <div className="camera-capture-buttons">
              <Button
                variant="outline"
                onClick={retakePhoto}
                disabled={isSaving}
                className="camera-capture-btn gap-2"
              >
                <RotateCcw className="h-5 w-5" />
                Repetir
              </Button>
              <Button
                onClick={confirmPhoto}
                disabled={isSaving}
                className="camera-capture-btn gap-2"
              >
                {isSaving ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <Check className="h-5 w-5" />
                )}
                {isSaving ? "Guardando..." : "Usar Foto"}
              </Button>
            </div>
          ) : (
            <div className="camera-capture-buttons-take">
              {/* FIX A: Always show switch button (disabled while loading/checking) */}
              {(hasMultipleCameras || isCheckingCameras) && (
                <Button
                  variant="outline"
                  size="icon"
                  onClick={switchCamera}
                  disabled={isLoading || isSwitching || isCheckingCameras}
                  title="Voltear cámara"
                  className="camera-capture-icon-btn"
                >
                  {isSwitching ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    <SwitchCamera className="h-5 w-5" />
                  )}
                </Button>
              )}
              <Button
                size="lg"
                onClick={takePhoto}
                disabled={isLoading || isSwitching}
                className="camera-capture-shutter"
              >
                <Camera className="h-8 w-8" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                onClick={handleClose}
                title="Cancelar"
                className="camera-capture-icon-btn"
              >
                <X className="h-5 w-5" />
              </Button>
            </div>
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
