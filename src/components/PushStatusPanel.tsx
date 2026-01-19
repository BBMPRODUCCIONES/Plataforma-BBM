import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { 
  CheckCircle2, 
  XCircle, 
  AlertCircle, 
  Smartphone, 
  Bell, 
  RefreshCw,
  Loader2 
} from "lucide-react";
import { 
  getDetailedPushStatus, 
  activatePushNotifications 
} from "@/lib/onesignal";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

interface PushStatus {
  supported: boolean;
  permission: "granted" | "denied" | "default";
  subscribed: boolean;
  userId: string | null;
  pushToken: string | null;
}

export function PushStatusPanel() {
  const { user } = useAuth();
  const [status, setStatus] = useState<PushStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [activating, setActivating] = useState(false);

  const loadStatus = async () => {
    setLoading(true);
    try {
      const pushStatus = await getDetailedPushStatus();
      setStatus(pushStatus);
    } catch (error) {
      console.error("Error loading push status:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStatus();
  }, []);

  const handleActivate = async () => {
    setActivating(true);
    try {
      const success = await activatePushNotifications();
      if (success) {
        toast.success("¡Notificaciones activadas!", {
          description: "Ahora recibirás notificaciones del sistema"
        });
        await loadStatus();
      } else {
        if (status?.permission === "denied") {
          toast.error("Notificaciones bloqueadas", {
            description: "Debes habilitarlas manualmente en la configuración del navegador"
          });
        } else {
          toast.error("No se pudieron activar las notificaciones");
        }
      }
    } catch (error) {
      console.error("Error activating:", error);
      toast.error("Error al activar notificaciones");
    } finally {
      setActivating(false);
      await loadStatus();
    }
  };

  const StatusIcon = ({ ok }: { ok: boolean | null }) => {
    if (ok === null) return <AlertCircle className="h-4 w-4 text-muted-foreground" />;
    return ok 
      ? <CheckCircle2 className="h-4 w-4 text-green-500" /> 
      : <XCircle className="h-4 w-4 text-red-500" />;
  };

  if (loading) {
    return (
      <div className="p-4 flex items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const isFullyWorking = status?.supported && status?.permission === "granted" && status?.subscribed && status?.userId;

  return (
    <div className="p-3 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Smartphone className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">Estado de Push</span>
        </div>
        <Button 
          variant="ghost" 
          size="icon" 
          className="h-7 w-7"
          onClick={loadStatus}
          disabled={loading}
        >
          <RefreshCw className="h-3.5 w-3.5" />
        </Button>
      </div>

      <Separator />

      <div className="space-y-2 text-xs">
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">Soportado</span>
          <div className="flex items-center gap-1.5">
            <StatusIcon ok={status?.supported ?? null} />
            <span>{status?.supported ? "Sí" : "No"}</span>
          </div>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">Permiso</span>
          <div className="flex items-center gap-1.5">
            <StatusIcon ok={status?.permission === "granted"} />
            <Badge variant={status?.permission === "granted" ? "default" : status?.permission === "denied" ? "destructive" : "secondary"} className="text-[10px] px-1.5 py-0">
              {status?.permission === "granted" ? "Permitido" : status?.permission === "denied" ? "Bloqueado" : "Sin definir"}
            </Badge>
          </div>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">Suscrito</span>
          <div className="flex items-center gap-1.5">
            <StatusIcon ok={status?.subscribed ?? false} />
            <span>{status?.subscribed ? "Sí" : "No"}</span>
          </div>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">Usuario vinculado</span>
          <div className="flex items-center gap-1.5">
            <StatusIcon ok={!!status?.userId} />
            <span>{status?.userId ? "Sí" : "No"}</span>
          </div>
        </div>
      </div>

      {status?.permission === "denied" && (
        <>
          <Separator />
          <div className="bg-destructive/10 rounded-md p-2 text-xs space-y-1">
            <p className="font-medium text-destructive">Notificaciones bloqueadas</p>
            <p className="text-muted-foreground">
              Para recibir notificaciones del sistema, debes habilitarlas manualmente:
            </p>
            <ul className="text-muted-foreground list-disc list-inside space-y-0.5 mt-1">
              <li><strong>PC:</strong> Clic en el icono del candado (🔒) → Notificaciones → Permitir</li>
              <li><strong>Android:</strong> Ajustes → Apps → (esta app) → Notificaciones → Activar</li>
              <li><strong>iPhone:</strong> Ajustes → Notificaciones → (esta app) → Permitir</li>
            </ul>
          </div>
        </>
      )}

      {!isFullyWorking && status?.permission !== "denied" && (
        <>
          <Separator />
          <Button 
            onClick={handleActivate} 
            disabled={activating || !user}
            className="w-full"
            size="sm"
          >
            {activating ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Activando...
              </>
            ) : (
              <>
                <Bell className="mr-2 h-4 w-4" />
                Activar notificaciones del sistema
              </>
            )}
          </Button>
          {!user && (
            <p className="text-[10px] text-muted-foreground text-center">
              Inicia sesión para activar notificaciones
            </p>
          )}
        </>
      )}

      {isFullyWorking && (
        <>
          <Separator />
          <div className="bg-green-500/10 rounded-md p-2 text-xs flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-green-500 flex-shrink-0" />
            <span className="text-green-700 dark:text-green-300">
              Las notificaciones del sistema están activas
            </span>
          </div>
        </>
      )}
    </div>
  );
}
