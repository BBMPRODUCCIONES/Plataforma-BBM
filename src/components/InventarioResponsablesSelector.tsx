import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Users, LogOut, LogIn, Package, X, Info, Clock } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useState, useMemo } from "react";
import { useUserRole } from "@/hooks/useUserRole";

export interface ResponsableAutoLog {
  userId?: string;
  nombre?: string;
  timestamp?: string;
}

interface InventarioResponsablesSelectorProps {
  responsableSalida: ResponsableAutoLog;
  responsableEntrada: ResponsableAutoLog;
  responsableEvento: ResponsableAutoLog;
  onResponsableSalidaChange: (data: ResponsableAutoLog) => void;
  onResponsableEntradaChange: (data: ResponsableAutoLog) => void;
  onResponsableEventoChange: (data: ResponsableAutoLog) => void;
}

const UNDO_WINDOW_MS = 5 * 60 * 1000; // 5 minutes

function useTimeLeft(timestamp?: string) {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    if (!timestamp) return;
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [timestamp]);

  if (!timestamp) return { canUndo: false, timeLeft: 0 };

  const elapsed = now - new Date(timestamp).getTime();
  const remaining = Math.max(0, UNDO_WINDOW_MS - elapsed);
  return { canUndo: remaining > 0, timeLeft: remaining };
}

function ResponsableSection({
  label,
  icon: Icon,
  data,
  onRegister,
  onClear,
  currentUserId,
  isAdmin,
}: {
  label: string;
  icon: React.ElementType;
  data: ResponsableAutoLog;
  onRegister: () => void;
  onClear: () => void;
  currentUserId?: string;
  isAdmin: boolean;
}) {
  const isRegistered = !!data.nombre;
  const { canUndo, timeLeft } = useTimeLeft(data.timestamp);
  const isOwnRegistration = data.userId === currentUserId;

  // Can clear if: admin always, or own registration within 5 min window
  const canClear = isAdmin || (isOwnRegistration && canUndo);

  const minutesLeft = Math.ceil(timeLeft / 60000);

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-1.5 text-xs font-medium">
        <Icon className="h-3.5 w-3.5" />
        {label}
      </div>

      {isRegistered ? (
        <div className="flex items-center justify-between bg-primary/10 border border-primary/20 rounded-md px-3 py-2">
          <div className="space-y-0.5">
            <p className="text-sm font-medium">{data.nombre}</p>
            <div className="flex items-center gap-2">
              {data.timestamp && (
                <p className="text-xs text-muted-foreground">
                  {format(new Date(data.timestamp), "dd MMM yyyy, HH:mm", { locale: es })}
                </p>
              )}
              {isOwnRegistration && canUndo && !isAdmin && (
                <span className="inline-flex items-center gap-1 text-[10px] text-amber-400">
                  <Clock className="h-3 w-3" />
                  {minutesLeft} min restantes
                </span>
              )}
            </div>
          </div>
          {canClear && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-destructive hover:text-destructive shrink-0"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onClear();
              }}
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      ) : (
        <Button
          type="button"
          variant="outline"
          className="w-full h-10 text-sm"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onRegister();
          }}
        >
          Registrarme como responsable
        </Button>
      )}
    </div>
  );
}

export function InventarioResponsablesSelector({
  responsableSalida,
  responsableEntrada,
  responsableEvento,
  onResponsableSalidaChange,
  onResponsableEntradaChange,
  onResponsableEventoChange,
}: InventarioResponsablesSelectorProps) {
  const { user } = useAuth();
  const { canEditStructure } = useUserRole();
  const isAdmin = canEditStructure();
  const [employeeName, setEmployeeName] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    supabase.rpc("get_my_employee").then(({ data }) => {
      if (data && data.length > 0) {
        setEmployeeName(data[0].nombre);
      } else {
        setEmployeeName(user.email || "Usuario");
      }
    });
  }, [user]);

  const registerAs = (onChange: (d: ResponsableAutoLog) => void) => {
    if (!user) return;
    onChange({
      userId: user.id,
      nombre: employeeName || user.email || "Usuario",
      timestamp: new Date().toISOString(),
    });
  };

  const clearResponsable = (onChange: (d: ResponsableAutoLog) => void) => {
    onChange({ userId: undefined, nombre: undefined, timestamp: undefined });
  };

  return (
    <Card className="mt-4 border-dashed">
      <CardHeader className="py-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <Users className="h-4 w-4" />
          Responsables del Inventario
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-start gap-2 text-[11px] text-muted-foreground bg-muted/50 rounded-md px-3 py-2">
          <Info className="h-3.5 w-3.5 mt-0.5 shrink-0" />
          <span>
            Al registrarte como responsable, tendrás 5 minutos para deshacer tu registro. Después de ese tiempo, solo un administrador podrá modificarlo.
          </span>
        </div>

        <ResponsableSection
          label="Responsable de Salida"
          icon={LogOut}
          data={responsableSalida}
          onRegister={() => registerAs(onResponsableSalidaChange)}
          onClear={() => clearResponsable(onResponsableSalidaChange)}
          currentUserId={user?.id}
          isAdmin={isAdmin}
        />

        <div className="border-t border-dashed" />

        <ResponsableSection
          label="Responsable de Entrada"
          icon={LogIn}
          data={responsableEntrada}
          onRegister={() => registerAs(onResponsableEntradaChange)}
          onClear={() => clearResponsable(onResponsableEntradaChange)}
          currentUserId={user?.id}
          isAdmin={isAdmin}
        />

        <div className="border-t border-dashed" />

        <ResponsableSection
          label="Responsable durante el Evento"
          icon={Package}
          data={responsableEvento}
          onRegister={() => registerAs(onResponsableEventoChange)}
          onClear={() => clearResponsable(onResponsableEventoChange)}
          currentUserId={user?.id}
          isAdmin={isAdmin}
        />
      </CardContent>
    </Card>
  );
}

export default InventarioResponsablesSelector;
