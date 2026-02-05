import { useState, useEffect } from "react";
import { Bell, X, AlertTriangle, CheckCircle, RefreshCw, Smartphone, Monitor, Apple } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { 
  promptForPushPermission, 
  isSubscribed,
  getPushStatus,
  getPermissionStatus
} from "@/lib/onesignal";
import { useAuth } from "@/contexts/AuthContext";

const PROMPT_DISMISSED_KEY = "bbm_notification_prompt_dismissed";
const PROMPT_DELAY = 2000;

type PromptState = "loading" | "show" | "denied" | "success" | "hidden";
type DeviceType = "pc" | "android" | "ios";

function detectDevice(): DeviceType {
  const ua = navigator.userAgent.toLowerCase();
  if (/iphone|ipad|ipod/.test(ua)) return "ios";
  if (/android/.test(ua)) return "android";
  return "pc";
}

export function NotificationPrompt() {
  const { user } = useAuth();
  const [state, setState] = useState<PromptState>("loading");
  const [loading, setLoading] = useState(false);
  const [deviceType] = useState<DeviceType>(detectDevice);

  useEffect(() => {
    if (!user) {
      setState("hidden");
      return;
    }

    const checkAndShow = async () => {
      console.log("[NotificationPrompt] Checking notification status...");
      
      // Check if already dismissed or subscribed
      const dismissed = localStorage.getItem(PROMPT_DISMISSED_KEY);
      
      // If dismissed (user clicked X or "Ya lo hice"), don't show again
      if (dismissed === "dismissed" || dismissed === "denied_dismissed") {
        console.log("[NotificationPrompt] Previously dismissed, not showing");
        setState("hidden");
        return;
      }
      
      if (dismissed === "subscribed") {
        // Verify still subscribed
        const subscribed = await isSubscribed();
        if (subscribed) {
          console.log("[NotificationPrompt] Already subscribed");
          setState("hidden");
          return;
        }
        // If not subscribed anymore, clear and re-prompt
        localStorage.removeItem(PROMPT_DISMISSED_KEY);
      }
      
      // Check full push status
      const status = await getPushStatus();
      console.log("[NotificationPrompt] Push status:", status);

      // If not supported, hide
      if (!status.supported) {
        console.log("[NotificationPrompt] Push not supported");
        setState("hidden");
        return;
      }

      // If permission denied, show blocked message ONLY ONCE
      if (status.permission === "denied") {
        console.log("[NotificationPrompt] Permission denied by browser");
        setState("denied");
        return;
      }

      // If already subscribed, hide
      if (status.subscribed) {
        console.log("[NotificationPrompt] Already subscribed");
        localStorage.setItem(PROMPT_DISMISSED_KEY, "subscribed");
        setState("hidden");
        return;
      }

      // Show prompt after delay (like WhatsApp does)
      setTimeout(() => {
        console.log("[NotificationPrompt] Showing prompt");
        setState("show");
      }, PROMPT_DELAY);
    };

    checkAndShow();
  }, [user]);

  const handleEnable = async () => {
    setLoading(true);
    console.log("[NotificationPrompt] User clicked enable");
    
    try {
      const success = await promptForPushPermission();
      console.log("[NotificationPrompt] Permission result:", success);
      
      if (success) {
        // Verify actually subscribed
        const subscribed = await isSubscribed();
        console.log("[NotificationPrompt] Subscription verified:", subscribed);
        
        if (subscribed) {
          localStorage.setItem(PROMPT_DISMISSED_KEY, "subscribed");
          setState("success");
          // Auto-hide after 3 seconds
          setTimeout(() => setState("hidden"), 3000);
        } else {
          // Permission granted but not subscribed - might need retry
          setState("show");
        }
      } else {
        // Check if it was denied
        const permission = await getPermissionStatus();
        if (permission === "denied") {
          setState("denied");
        }
      }
    } catch (error) {
      console.error("[NotificationPrompt] Error:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleDismiss = () => {
    // Mark as dismissed based on current state to prevent showing again
    if (state === "denied") {
      localStorage.setItem(PROMPT_DISMISSED_KEY, "denied_dismissed");
    } else {
      localStorage.setItem(PROMPT_DISMISSED_KEY, "dismissed");
    }
    setState("hidden");
  };

  const handleRetry = async () => {
    setLoading(true);
    // Clear dismissed state and try again
    localStorage.removeItem(PROMPT_DISMISSED_KEY);
    
    const status = await getPushStatus();
    if (status.permission !== "denied") {
      setState("show");
    }
    setLoading(false);
  };

  if (state === "loading" || state === "hidden") return null;

  // Success state
  if (state === "success") {
    return (
      <div className="fixed bottom-20 left-4 right-4 md:bottom-6 md:left-auto md:right-6 md:max-w-sm z-50 animate-in slide-in-from-bottom-5 duration-300">
        <Card className="bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800 shadow-lg">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-full bg-green-100 dark:bg-green-900">
                <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400" />
              </div>
              <div className="flex-1">
                <h4 className="font-semibold text-sm text-green-800 dark:text-green-200">
                  ¡Notificaciones activadas!
                </h4>
                <p className="text-xs text-green-600 dark:text-green-400">
                  Recibirás alertas cuando se creen o modifiquen eventos.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Denied state - show device-specific instructions
  if (state === "denied") {
    const getDeviceInstructions = () => {
      switch (deviceType) {
        case "ios":
          return {
            icon: <Apple className="h-5 w-5 text-amber-600 dark:text-amber-400" />,
            title: "Notificaciones bloqueadas",
            subtitle: "Para iPhone/iPad:",
            steps: [
              "Asegúrate de tener iOS 16.4 o superior",
              "La app debe estar instalada en Inicio (Compartir → Agregar a pantalla de inicio)",
              "Ve a Configuración → Notificaciones → [BBM]",
              "Activa 'Permitir notificaciones'",
              "Vuelve a abrir la app"
            ]
          };
        case "android":
          return {
            icon: <Smartphone className="h-5 w-5 text-amber-600 dark:text-amber-400" />,
            title: "Notificaciones bloqueadas",
            subtitle: "Para Android:",
            steps: [
              "Mantén presionado el ícono de la app o ve a Configuración",
              "Selecciona Aplicaciones → [BBM] o Chrome",
              "Toca 'Notificaciones'",
              "Activa 'Mostrar notificaciones'",
              "Recarga la página"
            ]
          };
        default:
          return {
            icon: <Monitor className="h-5 w-5 text-amber-600 dark:text-amber-400" />,
            title: "Notificaciones bloqueadas",
            subtitle: "Para PC:",
            steps: [
              "Haz clic en el ícono de candado 🔒 en la barra de direcciones",
              "Busca 'Notificaciones'",
              "Cambia a 'Permitir'",
              "Recarga la página"
            ]
          };
      }
    };

    const instructions = getDeviceInstructions();

    return (
      <div className="fixed bottom-20 left-4 right-4 md:bottom-6 md:left-auto md:right-6 md:max-w-sm z-50 animate-in slide-in-from-bottom-5 duration-300">
        <Card className="bg-amber-50 dark:bg-amber-950 border-amber-200 dark:border-amber-800 shadow-lg">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-full bg-amber-100 dark:bg-amber-900">
                {instructions.icon}
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="font-semibold text-sm text-amber-800 dark:text-amber-200 mb-1">
                  {instructions.title}
                </h4>
                <p className="text-xs text-amber-700 dark:text-amber-300 mb-2 font-medium">
                  {instructions.subtitle}
                </p>
                <ol className="text-xs text-amber-600 dark:text-amber-400 list-decimal list-inside space-y-1 mb-3">
                  {instructions.steps.map((step, idx) => (
                    <li key={idx}>{step}</li>
                  ))}
                </ol>
                <div className="flex gap-2">
                  <Button 
                    size="sm" 
                    variant="outline"
                    onClick={handleRetry}
                    disabled={loading}
                    className="flex-1 text-amber-700 border-amber-300 hover:bg-amber-100 dark:text-amber-300 dark:border-amber-700 dark:hover:bg-amber-900"
                  >
                    <RefreshCw className={`h-3 w-3 mr-1 ${loading ? 'animate-spin' : ''}`} />
                    Ya lo hice
                  </Button>
                  <Button 
                    size="sm" 
                    variant="ghost"
                    onClick={handleDismiss}
                    className="text-amber-600 hover:bg-amber-100 dark:text-amber-400 dark:hover:bg-amber-900"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Default prompt state
  return (
    <div className="fixed bottom-20 left-4 right-4 md:bottom-6 md:left-auto md:right-6 md:max-w-sm z-50 animate-in slide-in-from-bottom-5 duration-300">
      <Card className="bg-card border-primary/20 shadow-lg">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-full bg-primary/10">
              <Bell className="h-5 w-5 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <h4 className="font-semibold text-sm mb-1">Activar notificaciones</h4>
              <p className="text-xs text-muted-foreground mb-3">
                Recibe alertas cuando se creen, eliminen o restauren eventos.
              </p>
              <div className="flex gap-2">
                <Button 
                  size="sm" 
                  onClick={handleEnable}
                  disabled={loading}
                  className="flex-1"
                >
                  {loading ? "Activando..." : "Activar"}
                </Button>
                <Button 
                  size="sm" 
                  variant="ghost"
                  onClick={handleDismiss}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
