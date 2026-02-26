import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Users, LogOut, LogIn, Package, X } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useState } from "react";

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

function ResponsableSection({
  label,
  icon: Icon,
  data,
  onRegister,
  onClear,
}: {
  label: string;
  icon: React.ElementType;
  data: ResponsableAutoLog;
  onRegister: () => void;
  onClear: () => void;
}) {
  const isRegistered = !!data.nombre;

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
            {data.timestamp && (
              <p className="text-xs text-muted-foreground">
                {format(new Date(data.timestamp), "dd MMM yyyy, HH:mm", { locale: es })}
              </p>
            )}
          </div>
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
  const [employeeName, setEmployeeName] = useState<string | null>(null);

  // Fetch employee name linked to current user
  useEffect(() => {
    if (!user) return;
    supabase.rpc("get_my_employee").then(({ data }) => {
      if (data && data.length > 0) {
        setEmployeeName(data[0].nombre);
      } else {
        // Fallback to email
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
        <ResponsableSection
          label="Responsable de Salida"
          icon={LogOut}
          data={responsableSalida}
          onRegister={() => registerAs(onResponsableSalidaChange)}
          onClear={() => clearResponsable(onResponsableSalidaChange)}
        />

        <div className="border-t border-dashed" />

        <ResponsableSection
          label="Responsable de Entrada"
          icon={LogIn}
          data={responsableEntrada}
          onRegister={() => registerAs(onResponsableEntradaChange)}
          onClear={() => clearResponsable(onResponsableEntradaChange)}
        />

        <div className="border-t border-dashed" />

        <ResponsableSection
          label="Responsable durante el Evento"
          icon={Package}
          data={responsableEvento}
          onRegister={() => registerAs(onResponsableEventoChange)}
          onClear={() => clearResponsable(onResponsableEventoChange)}
        />
      </CardContent>
    </Card>
  );
}

export default InventarioResponsablesSelector;
