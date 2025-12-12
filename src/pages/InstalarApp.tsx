import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Download, Smartphone, Check, Camera, MapPin, Wifi, WifiOff } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export default function InstalarApp() {
  const navigate = useNavigate();
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [isIOS, setIsIOS] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);

  useEffect(() => {
    // Check if iOS
    const iOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    setIsIOS(iOS);

    // Check if already installed (standalone mode)
    const standalone = window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as any).standalone === true;
    setIsStandalone(standalone);
    setIsInstalled(standalone);

    // Listen for install prompt
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    // Listen for app installed
    const handleAppInstalled = () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
    };

    // Online/offline status
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;

    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    
    if (outcome === 'accepted') {
      setIsInstalled(true);
    }
    setDeferredPrompt(null);
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 w-20 h-20 bg-primary/10 rounded-2xl flex items-center justify-center">
            <Smartphone className="h-10 w-10 text-primary" />
          </div>
          <CardTitle className="text-2xl">Instalar BBM Producciones</CardTitle>
          <CardDescription>
            Instala la app para acceso rápido y funciones offline
          </CardDescription>
        </CardHeader>
        
        <CardContent className="space-y-6">
          {/* Status indicator */}
          <div className="flex items-center justify-center gap-2 text-sm">
            {isOnline ? (
              <>
                <Wifi className="h-4 w-4 text-green-500" />
                <span className="text-green-500">Conectado</span>
              </>
            ) : (
              <>
                <WifiOff className="h-4 w-4 text-amber-500" />
                <span className="text-amber-500">Sin conexión</span>
              </>
            )}
          </div>

          {/* Features */}
          <div className="space-y-3">
            <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
              <Camera className="h-5 w-5 text-primary" />
              <div>
                <p className="text-sm font-medium">Cámara integrada</p>
                <p className="text-xs text-muted-foreground">Toma fotos de llegada/salida</p>
              </div>
            </div>
            
            <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
              <MapPin className="h-5 w-5 text-primary" />
              <div>
                <p className="text-sm font-medium">Geolocalización</p>
                <p className="text-xs text-muted-foreground">Registra ubicación automática</p>
              </div>
            </div>
            
            <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
              <Download className="h-5 w-5 text-primary" />
              <div>
                <p className="text-sm font-medium">Acceso rápido</p>
                <p className="text-xs text-muted-foreground">Desde tu pantalla de inicio</p>
              </div>
            </div>
          </div>

          {/* Install button or instructions */}
          {isInstalled || isStandalone ? (
            <div className="text-center space-y-3">
              <div className="flex items-center justify-center gap-2 text-green-500">
                <Check className="h-5 w-5" />
                <span className="font-medium">App instalada correctamente</span>
              </div>
              <Button onClick={() => navigate('/')} className="w-full">
                Ir a la aplicación
              </Button>
            </div>
          ) : deferredPrompt ? (
            <Button onClick={handleInstall} className="w-full gap-2" size="lg">
              <Download className="h-5 w-5" />
              Instalar App
            </Button>
          ) : isIOS ? (
            <div className="space-y-3">
              <p className="text-sm text-center text-muted-foreground">
                Para instalar en iPhone/iPad:
              </p>
              <ol className="text-sm space-y-2 text-muted-foreground">
                <li className="flex gap-2">
                  <span className="font-bold text-primary">1.</span>
                  Toca el botón <strong>Compartir</strong> (ícono de cuadro con flecha)
                </li>
                <li className="flex gap-2">
                  <span className="font-bold text-primary">2.</span>
                  Desplázate y selecciona <strong>"Agregar a Inicio"</strong>
                </li>
                <li className="flex gap-2">
                  <span className="font-bold text-primary">3.</span>
                  Toca <strong>"Agregar"</strong> para confirmar
                </li>
              </ol>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-center text-muted-foreground">
                Para instalar en Android:
              </p>
              <ol className="text-sm space-y-2 text-muted-foreground">
                <li className="flex gap-2">
                  <span className="font-bold text-primary">1.</span>
                  Abre el menú del navegador (⋮)
                </li>
                <li className="flex gap-2">
                  <span className="font-bold text-primary">2.</span>
                  Selecciona <strong>"Instalar app"</strong> o <strong>"Agregar a inicio"</strong>
                </li>
                <li className="flex gap-2">
                  <span className="font-bold text-primary">3.</span>
                  Confirma la instalación
                </li>
              </ol>
            </div>
          )}

          <Button 
            variant="outline" 
            onClick={() => navigate('/')} 
            className="w-full"
          >
            Continuar en navegador
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
