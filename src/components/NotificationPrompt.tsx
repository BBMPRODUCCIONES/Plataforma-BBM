import { useState, useEffect } from "react";
import { Bell, X, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { 
  promptForPushPermission, 
  isSubscribed,
  getPushStatus,
  getPermissionStatus
} from "@/lib/onesignal";
import { useAuth } from "@/contexts/AuthContext";

const PROMPT_DISMISSED_KEY = "bbm_notification_prompt_dismissed";
const PROMPT_DELAY = 2000;

type PromptState = "loading" | "show" | "success" | "hidden";
export function NotificationPrompt() {
  const { user } = useAuth();
  const [state, setState] = useState<PromptState>("loading");
  const [loading, setLoading] = useState(false);

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

      // Permiso denegado: no se muestra nada. El muro de instrucciones naranja
      // tapaba media pantalla en el celular, y el usuario puede activar las
      // notificaciones cuando quiera desde los ajustes del navegador.
      if (status.permission === "denied") {
        console.log("[NotificationPrompt] Permission denied by browser, staying silent");
        localStorage.setItem(PROMPT_DISMISSED_KEY, "denied_dismissed");
        setState("hidden");
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
        const permission = await getPermissionStatus();
        if (permission === "denied") {
          localStorage.setItem(PROMPT_DISMISSED_KEY, "denied_dismissed");
          setState("hidden");
        }
      }
    } catch (error) {
      console.error("[NotificationPrompt] Error:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleDismiss = () => {
    // Al cerrarlo no vuelve a aparecer.
    localStorage.setItem(PROMPT_DISMISSED_KEY, "dismissed");
    setState("hidden");
  };

  if (state === "loading" || state === "hidden") return null;

  // Aviso breve de una linea cuando se activan
  if (state === "success") {
    return (
      <div className="notif-toast">
        <div className="flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 shadow-sm backdrop-blur">
          <CheckCircle className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
          <span className="text-xs font-medium text-emerald-700 dark:text-emerald-300">
            Notificaciones activadas
          </span>
        </div>
      </div>
    );
  }

  // Prompt por defecto: barra compacta de una sola linea, no una tarjeta grande.
  return (
    <div className="notif-toast">
      <div className="flex items-center gap-2 rounded-full border border-border bg-card/95 py-1.5 pl-3 pr-1.5 shadow-sm backdrop-blur">
        <Bell className="h-4 w-4 shrink-0 text-primary" />
        <span className="flex-1 truncate text-xs text-foreground">Activar notificaciones</span>
        <Button
          size="sm"
          onClick={handleEnable}
          disabled={loading}
          className="h-7 rounded-full px-3 text-xs"
        >
          {loading ? "..." : "Activar"}
        </Button>
        <Button
          size="icon"
          variant="ghost"
          aria-label="Cerrar aviso de notificaciones"
          onClick={handleDismiss}
          className="h-7 w-7 rounded-full text-muted-foreground"
        >
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}
