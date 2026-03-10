import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Users, LogOut, LogIn, Package, X, Info, Clock, Search, Check, ChevronDown } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useState, useMemo } from "react";
import { useUserRole } from "@/hooks/useUserRole";
import { useEmpleados } from "@/contexts/EmpleadosContext";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

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
  highlightMissing?: boolean;
  readOnly?: boolean;
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

const normalizeText = (text: string): string => {
  return text.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
};

function EmpleadoSelectorPopover({
  onSelect,
  placeholder = "Seleccionar responsable...",
}: {
  onSelect: (nombre: string, userId?: string) => void;
  placeholder?: string;
}) {
  const { empleados } = useEmpleados();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    if (!search.trim()) return empleados;
    const norm = normalizeText(search);
    return empleados.filter(e => normalizeText(e.nombre).includes(norm) || normalizeText(e.cargo).includes(norm));
  }, [empleados, search]);

  return (
    <Popover open={open} onOpenChange={setOpen} modal={true}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          className="w-full h-10 text-sm justify-between font-normal"
        >
          <span className="text-muted-foreground">{placeholder}</span>
          <ChevronDown className="h-4 w-4 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-[320px] p-0 z-[9999]"
        align="start"
        side="bottom"
        sideOffset={4}
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <div className="p-2 border-b border-border">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar empleado..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 h-9"
              autoFocus
            />
          </div>
        </div>
        <div className="max-h-[220px] overflow-y-auto">
          {filtered.length === 0 ? (
            <div className="p-4 text-center text-sm text-muted-foreground">Sin resultados</div>
          ) : (
            filtered.map((emp) => (
              <button
                key={emp.id}
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onSelect(emp.nombre, undefined);
                  setSearch("");
                  setOpen(false);
                }}
                className="flex items-center gap-3 px-3 py-2.5 cursor-pointer hover:bg-accent transition-colors border-b border-border/50 last:border-b-0 w-full text-left"
              >
                <div className="w-8 h-8 rounded-full bg-primary/15 flex items-center justify-center shrink-0">
                  <Users className="h-3.5 w-3.5 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{emp.nombre}</p>
                  <p className="text-xs text-muted-foreground truncate">{emp.cargo || "Sin cargo"}</p>
                </div>
              </button>
            ))
          )}
        </div>
        <div className="px-3 py-1.5 border-t border-border bg-muted/30">
          <p className="text-[10px] text-muted-foreground text-center">
            {filtered.length} de {empleados.length} empleado{empleados.length !== 1 ? "s" : ""}
          </p>
        </div>
      </PopoverContent>
    </Popover>
  );
}

function ResponsableSection({
  label,
  icon: Icon,
  data,
  onRegister,
  onAssign,
  onClear,
  currentUserId,
  isAdmin,
  isProductor,
}: {
  label: string;
  icon: React.ElementType;
  data: ResponsableAutoLog;
  onRegister: () => void;
  onAssign: (nombre: string, userId?: string) => void;
  onClear: () => void;
  currentUserId?: string;
  isAdmin: boolean;
  isProductor: boolean;
}) {
  const isRegistered = !!data.nombre;
  const { canUndo, timeLeft } = useTimeLeft(data.timestamp);
  const isOwnRegistration = data.userId === currentUserId;

  // Can clear if: admin always, productor always, or own registration within 5 min window
  const canClear = isAdmin || isProductor || (isOwnRegistration && canUndo);

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
              {isOwnRegistration && canUndo && !isAdmin && !isProductor && (
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
      ) : isProductor || isAdmin ? (
        <div className="space-y-2">
          <EmpleadoSelectorPopover
            onSelect={onAssign}
            placeholder="Seleccionar responsable..."
          />
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
  highlightMissing = false,
}: InventarioResponsablesSelectorProps) {
  const { user } = useAuth();
  const { canEditStructure, canCrearAnticipos } = useUserRole();
  const isAdmin = canEditStructure();
  const isProductor = canCrearAnticipos();
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

  const assignResponsable = (onChange: (d: ResponsableAutoLog) => void, nombre: string, userId?: string) => {
    onChange({
      userId: userId || user?.id,
      nombre,
      timestamp: new Date().toISOString(),
    });
  };

  const clearResponsable = (onChange: (d: ResponsableAutoLog) => void) => {
    onChange({ userId: undefined, nombre: undefined, timestamp: undefined });
  };

  const hasMissing = highlightMissing && (!responsableSalida.nombre || !responsableEntrada.nombre || !responsableEvento.nombre);

  return (
    <Card className={cn("mt-4 border-dashed transition-colors", hasMissing && "border-destructive border-2 ring-2 ring-destructive/30")}>
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
            {isProductor || isAdmin
              ? "Como productor, puedes asignar responsables seleccionándolos de la lista de empleados o registrarte tú mismo."
              : "Al registrarte como responsable, tendrás 5 minutos para deshacer tu registro. Después de ese tiempo, solo un administrador podrá modificarlo."}
          </span>
        </div>

        <ResponsableSection
          label="Responsable de Salida"
          icon={LogOut}
          data={responsableSalida}
          onRegister={() => registerAs(onResponsableSalidaChange)}
          onAssign={(nombre, userId) => assignResponsable(onResponsableSalidaChange, nombre, userId)}
          onClear={() => clearResponsable(onResponsableSalidaChange)}
          currentUserId={user?.id}
          isAdmin={isAdmin}
          isProductor={isProductor}
        />

        <div className="border-t border-dashed" />

        <ResponsableSection
          label="Responsable de Entrada"
          icon={LogIn}
          data={responsableEntrada}
          onRegister={() => registerAs(onResponsableEntradaChange)}
          onAssign={(nombre, userId) => assignResponsable(onResponsableEntradaChange, nombre, userId)}
          onClear={() => clearResponsable(onResponsableEntradaChange)}
          currentUserId={user?.id}
          isAdmin={isAdmin}
          isProductor={isProductor}
        />

        <div className="border-t border-dashed" />

        <ResponsableSection
          label="Responsable durante el Evento"
          icon={Package}
          data={responsableEvento}
          onRegister={() => registerAs(onResponsableEventoChange)}
          onAssign={(nombre, userId) => assignResponsable(onResponsableEventoChange, nombre, userId)}
          onClear={() => clearResponsable(onResponsableEventoChange)}
          currentUserId={user?.id}
          isAdmin={isAdmin}
          isProductor={isProductor}
        />
      </CardContent>
    </Card>
  );
}

export default InventarioResponsablesSelector;
