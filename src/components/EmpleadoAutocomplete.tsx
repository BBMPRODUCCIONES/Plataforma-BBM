import { useState, useMemo, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { User, Check, Search, AlertCircle, Loader2, UserX } from "lucide-react";
import { useEmpleados } from "@/contexts/EmpleadosContext";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";

interface EmpleadoAutocompleteProps {
  value: string;
  onChange: (value: string, empleadoId?: string) => void;
  tipoPersonal?: "BBM" | "Proveedor" | "Transporte";
  useEmpleadoId?: boolean;
  placeholder?: string;
  className?: string;
}

const normalizeText = (text: string): string => {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
};

export function EmpleadoAutocomplete({
  value,
  onChange,
  tipoPersonal = "BBM",
  useEmpleadoId = false,
  placeholder = "Buscar empleado...",
  className,
}: EmpleadoAutocompleteProps) {
  const { empleados, loading, getEmpleadoNameById } = useEmpleados();
  const [open, setOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [deletedEmployeeName, setDeletedEmployeeName] = useState<string | null>(null);

  // Find selected employee
  const selectedEmpleado = useMemo(() => {
    if (!value) return null;
    return empleados.find(e => e.id === value || e.nombre === value) || null;
  }, [value, empleados]);

  // Check if selected employee was deleted (soft-deleted)
  const empleadoDeleted = useMemo(() => {
    return value && !selectedEmpleado && empleados.length > 0 && !loading;
  }, [value, selectedEmpleado, empleados.length, loading]);

  // Fetch name for deleted employee (from soft-deleted records)
  useEffect(() => {
    if (empleadoDeleted && value) {
      getEmpleadoNameById(value).then(name => {
        setDeletedEmployeeName(name);
      });
    } else {
      setDeletedEmployeeName(null);
    }
  }, [empleadoDeleted, value, getEmpleadoNameById]);

  // Filter employees based on search
  const filteredEmpleados = useMemo(() => {
    if (!searchTerm.trim()) return empleados;
    const normalized = normalizeText(searchTerm);
    return empleados.filter(emp => {
      const nombre = normalizeText(emp.nombre || "");
      const cargo = normalizeText(emp.cargo || "");
      return nombre.includes(normalized) || cargo.includes(normalized);
    });
  }, [empleados, searchTerm]);

  const handleSelect = (empleado: typeof empleados[0]) => {
    if (useEmpleadoId) {
      onChange(empleado.id, empleado.id);
    } else {
      onChange(empleado.nombre, empleado.id);
    }
    setSearchTerm("");
    setOpen(false);
  };

  // Display the employee name - show deleted employee's real name if available
  const displayValue = selectedEmpleado?.nombre || 
    (empleadoDeleted && deletedEmployeeName ? `${deletedEmployeeName} (inactivo)` : 
    (empleadoDeleted ? "Empleado eliminado" : ""));

  // For BBM type or when useEmpleadoId is true: strict selection with Popover
  if (tipoPersonal === "BBM" || useEmpleadoId) {
    return (
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            onClick={(e) => e.stopPropagation()}
            className={cn(
              "w-full justify-between font-normal h-9 px-3 bg-background",
              empleadoDeleted && "border-destructive text-destructive",
              !displayValue && "text-muted-foreground",
              className
            )}
          >
            <span className="truncate flex-1 text-left">
              {displayValue || placeholder}
            </span>
            <Search className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent 
          className="w-[320px] p-0" 
          align="start"
          side="bottom"
          sideOffset={4}
          onOpenAutoFocus={(e) => e.preventDefault()}
        >
          {/* Search input */}
          <div className="p-2 border-b border-border">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nombre o cargo..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 h-9"
                autoFocus
              />
            </div>
          </div>

          {/* Header */}
          <div className="px-3 py-2 border-b border-border bg-muted/50">
            <p className="text-[10px] text-muted-foreground flex items-center gap-1.5 font-medium">
              <AlertCircle className="h-3 w-3" />
              Solo empleados de "Creación de Empleados"
            </p>
          </div>

          {/* Employee list */}
          <div className="max-h-[250px] overflow-y-auto">
            {loading ? (
              <div className="p-6 text-center">
                <Loader2 className="h-8 w-8 mx-auto animate-spin text-primary" />
                <p className="text-sm text-muted-foreground mt-3">Cargando empleados...</p>
              </div>
            ) : empleados.length === 0 ? (
              <div className="p-6 text-center">
                <UserX className="h-10 w-10 mx-auto text-muted-foreground/40 mb-3" />
                <p className="text-sm font-medium text-foreground">No hay empleados registrados</p>
                <p className="text-xs text-muted-foreground mt-1.5">
                  Créelos primero en "Creación de Empleados"
                </p>
              </div>
            ) : filteredEmpleados.length === 0 ? (
              <div className="p-6 text-center">
                <Search className="h-10 w-10 mx-auto text-muted-foreground/40 mb-3" />
                <p className="text-sm font-medium text-foreground">Sin coincidencias</p>
                <p className="text-xs text-muted-foreground mt-1.5">
                  Intenta con otro nombre o cargo
                </p>
              </div>
            ) : (
              filteredEmpleados.map((empleado) => (
                <div
                  key={empleado.id}
                  onClick={() => handleSelect(empleado)}
                  className={cn(
                    "flex items-center gap-3 px-3 py-3 cursor-pointer hover:bg-accent transition-colors border-b border-border/50 last:border-b-0",
                    selectedEmpleado?.id === empleado.id && "bg-accent"
                  )}
                >
                  <div className="w-9 h-9 rounded-full bg-primary/15 flex items-center justify-center flex-shrink-0">
                    <User className="h-4 w-4 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate text-foreground">{empleado.nombre}</div>
                    <div className="text-xs text-muted-foreground truncate">
                      {empleado.cargo || "Sin cargo asignado"}
                    </div>
                  </div>
                  {selectedEmpleado?.id === empleado.id && (
                    <Check className="h-5 w-5 text-primary flex-shrink-0" />
                  )}
                </div>
              ))
            )}
          </div>

          {/* Footer with count */}
          {empleados.length > 0 && (
            <div className="px-3 py-2 border-t border-border bg-muted/30">
              <p className="text-[10px] text-muted-foreground text-center">
                {filteredEmpleados.length} de {empleados.length} empleado{empleados.length !== 1 ? "s" : ""}
              </p>
            </div>
          )}
        </PopoverContent>
      </Popover>
    );
  }

  // For Proveedor/Transporte: free text input with suggestions
  return (
    <Popover open={open && searchTerm.length > 0 && filteredEmpleados.length > 0} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Input
          value={value}
          onChange={(e) => {
            onChange(e.target.value);
            setSearchTerm(e.target.value);
            if (!open) setOpen(true);
          }}
          onFocus={() => {
            setSearchTerm(value);
            setOpen(true);
          }}
          onClick={(e) => e.stopPropagation()}
          placeholder={placeholder}
          className={cn("h-9 bg-background", className)}
        />
      </PopoverTrigger>
      <PopoverContent 
        className="w-[280px] p-0" 
        align="start"
        side="bottom"
        sideOffset={4}
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <div className="px-3 py-1.5 border-b border-border bg-muted/50">
          <span className="text-[10px] text-muted-foreground font-medium">
            Sugerencias (opcional)
          </span>
        </div>
        <div className="max-h-[200px] overflow-y-auto">
          {filteredEmpleados.slice(0, 5).map((empleado) => (
            <div
              key={empleado.id}
              onClick={() => {
                onChange(empleado.nombre, empleado.id);
                setSearchTerm("");
                setOpen(false);
              }}
              className="flex items-center gap-2 px-3 py-2.5 cursor-pointer hover:bg-accent transition-colors"
            >
              <User className="h-4 w-4 text-muted-foreground flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="text-sm truncate text-foreground">{empleado.nombre}</div>
                <div className="text-xs text-muted-foreground truncate">
                  {empleado.cargo || "Sin cargo"}
                </div>
              </div>
            </div>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

export default EmpleadoAutocomplete;
