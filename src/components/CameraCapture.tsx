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
// Persist last used camera preference in localStorage (WEB feature)
  const getInitialFacingMode = (): "user" | "environment" => {
    try {
      const saved = localStorage.getItem("camera-facing-mode");
      if (saved === "user" || saved === "environment") return saved;
    } catch {}
    return "environment";
  };
  
  const [facingMode, setFacingMode] = useState<"user" | "environment">(getInitialFacingMode);
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
      // Don't reset facingMode - keep user's preference
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
      // Persist preference for next time (WEB feature)
      try {
        localStorage.setItem("camera-facing-mode", newMode);
      } catch {}
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
      <DialogContent className="camera-capture-dialog p-0">
        {/* Header fijo - siempre visible */}
        <div className="camera-header">
          <div className="camera-header-content">
            <div className="flex items-center gap-2">
              <Camera className="h-5 w-5 text-primary" />
              <span className="font-semibold">Tomar Foto</span>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleClose}
              className="h-9 w-9 rounded-full hover:bg-muted"
              title="Cerrar"
            >
              <X className="h-5 w-5" />
            </Button>
          </div>
        </div>
        
        {/* Body - preview de cámara/foto */}
        <div className="camera-body">
          {(isLoading || isSwitching) && (
            <div className="camera-loading">
              <Loader2 className="h-10 w-10 animate-spin text-primary" />
              <span className="text-sm text-muted-foreground mt-2">
                {isSwitching ? "Cambiando cámara..." : "Iniciando cámara..."}
              </span>
            </div>
          )}
          
          {capturedImage ? (
            <img 
              src={capturedImage} 
              alt="Foto capturada" 
              className="camera-media"
            />
          ) : (
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="camera-media"
            />
          )}
          
          <canvas ref={canvasRef} className="hidden" />
        </div>
        
        {/* Footer fijo - botones siempre visibles */}
        <div className="camera-footer">
          {capturedImage ? (
            <div className="camera-footer-buttons">
              <Button
                variant="outline"
                onClick={retakePhoto}
                disabled={isSaving}
                className="camera-btn-secondary"
              >
                <RotateCcw className="h-5 w-5" />
                <span>Repetir</span>
              </Button>
              <Button
                onClick={confirmPhoto}
                disabled={isSaving}
                className="camera-btn-primary"
              >
                {isSaving ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <Check className="h-5 w-5" />
                )}
                <span>{isSaving ? "Guardando..." : "Usar Foto"}</span>
              </Button>
            </div>
          ) : (
            <div className="camera-footer-buttons-capture">
              {/* Cancelar a la izquierda */}
              <Button
                variant="outline"
                onClick={handleClose}
                className="camera-btn-cancel"
              >
                <X className="h-5 w-5" />
                <span className="hidden sm:inline">Cancelar</span>
              </Button>
              
              {/* Botón capturar (grande, centrado) */}
              <button
                onClick={takePhoto}
                disabled={isLoading || isSwitching}
                className="camera-shutter-btn"
                title="Tomar foto"
              >
                <div className="camera-shutter-inner">
                  <Camera className="h-8 w-8 text-white" />
                </div>
              </button>
              
              {/* Cambiar cámara a la derecha */}
              {(hasMultipleCameras || isCheckingCameras) ? (
                <Button
                  variant="outline"
                  onClick={switchCamera}
                  disabled={isLoading || isSwitching || isCheckingCameras}
                  className="camera-btn-switch"
                >
                  {isSwitching ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    <SwitchCamera className="h-5 w-5" />
                  )}
                  <span className="hidden sm:inline">Cambiar</span>
                </Button>
              ) : (
                <div className="w-[100px]" /> // Spacer para mantener centrado el shutter
              )}
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
