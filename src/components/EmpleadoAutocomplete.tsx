import { useState, useRef, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { User, Check, Search, AlertCircle, Loader2, ChevronDown, UserX } from "lucide-react";
import { useEmpleados } from "@/contexts/EmpleadosContext";

interface EmpleadoAutocompleteProps {
  value: string; // Can be empleadoId or nombre depending on usage
  onChange: (value: string, empleadoId?: string) => void;
  tipoPersonal?: "BBM" | "Proveedor" | "Transporte";
  useEmpleadoId?: boolean; // If true, value is empleadoId, display nombre
  placeholder?: string;
  className?: string;
}

// Remove accents for search comparison
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
  const { empleados, loading } = useEmpleados();
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Resolve display value when using empleadoId mode
  const selectedEmpleado = useEmpleadoId ? empleados.find(e => e.id === value) : null;
  const resolvedDisplayValue = useEmpleadoId 
    ? selectedEmpleado?.nombre || ""
    : value;

  // Check if there's a saved empleadoId but employee was deleted
  const empleadoDeleted = useEmpleadoId && value && !selectedEmpleado && !loading;

  const [inputValue, setInputValue] = useState(resolvedDisplayValue);

  // Filter employees by search term (accent-insensitive)
  const searchTerm = normalizeText(inputValue);
  const filteredEmpleados = empleados.filter(e => {
    const nombreNormalized = normalizeText(e.nombre);
    const cargoNormalized = e.cargo ? normalizeText(e.cargo) : "";
    return nombreNormalized.includes(searchTerm) || cargoNormalized.includes(searchTerm);
  });

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (
        containerRef.current && 
        !containerRef.current.contains(target) &&
        dropdownRef.current &&
        !dropdownRef.current.contains(target)
      ) {
        setIsOpen(false);
        // Reset input if no valid selection for BBM or useEmpleadoId mode
        if ((tipoPersonal === "BBM" || useEmpleadoId) && !empleados.some(e => e.nombre === inputValue || e.id === value)) {
          setInputValue(resolvedDisplayValue);
        }
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [inputValue, resolvedDisplayValue, empleados, tipoPersonal, useEmpleadoId, value]);

  // Sync input value when external value changes
  useEffect(() => {
    const newDisplayValue = useEmpleadoId 
      ? empleados.find(e => e.id === value)?.nombre || ""
      : value;
    if (newDisplayValue !== inputValue && !isOpen) {
      setInputValue(newDisplayValue);
    }
  }, [value, empleados, useEmpleadoId]);

  const handleSelectEmpleado = (empleado: typeof empleados[0]) => {
    // When using empleadoId mode, pass empleadoId as the main value
    if (useEmpleadoId) {
      onChange(empleado.id, empleado.id);
    } else {
      onChange(empleado.nombre, empleado.id);
    }
    setInputValue(empleado.nombre);
    setIsOpen(false);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setInputValue(newValue);
    if (!isOpen) setIsOpen(true);
  };

  const handleBlur = () => {
    // For non-BBM types, allow free text input
    if (tipoPersonal !== "BBM" && !useEmpleadoId && inputValue !== value) {
      onChange(inputValue);
    }
    // Delay close to allow click on dropdown items
    setTimeout(() => setIsOpen(false), 200);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      setIsOpen(false);
      inputRef.current?.blur();
    }
  };

  const handleFocus = () => {
    setIsOpen(true);
  };

  // Check if an employee is currently selected
  const isSelected = (empleado: typeof empleados[0]) => {
    if (useEmpleadoId) {
      return value === empleado.id;
    }
    return value === empleado.nombre || inputValue === empleado.nombre;
  };

  // Render dropdown using relative positioning within the container
  const renderDropdown = () => {
    if (!isOpen) return null;

    if (useEmpleadoId || tipoPersonal === "BBM") {
      return (
        <div 
          ref={dropdownRef}
          className="absolute top-full left-0 right-0 mt-1 z-[99999] rounded-md border border-border bg-popover shadow-2xl"
          style={{ maxHeight: '320px' }}
        >
          <div className="px-3 py-2 border-b border-border bg-muted/50">
            <p className="text-[10px] text-muted-foreground flex items-center gap-1.5 font-medium">
              <AlertCircle className="h-3 w-3" />
              Solo empleados de "Creación de Empleados"
            </p>
          </div>
          <div className="max-h-[260px] overflow-y-auto overscroll-contain">
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
                  onMouseDown={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    handleSelectEmpleado(empleado);
                  }}
                  className={cn(
                    "flex items-center gap-3 px-3 py-3 cursor-pointer hover:bg-accent/80 transition-colors border-b border-border/50 last:border-b-0",
                    isSelected(empleado) && "bg-accent"
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
                  {isSelected(empleado) && (
                    <Check className="h-5 w-5 text-primary flex-shrink-0" />
                  )}
                </div>
              ))
            )}
          </div>
          {filteredEmpleados.length > 0 && (
            <div className="px-3 py-2 border-t border-border bg-muted/30">
              <p className="text-[10px] text-muted-foreground text-center">
                {filteredEmpleados.length} de {empleados.length} empleado{empleados.length !== 1 ? 's' : ''}
              </p>
            </div>
          )}
        </div>
      );
    }

    // For Proveedor/Transporte suggestions
    if (filteredEmpleados.length === 0) return null;

    return (
      <div 
        ref={dropdownRef}
        className="absolute top-full left-0 right-0 mt-1 z-[99999] rounded-md border border-border bg-popover shadow-2xl"
      >
        <div className="px-3 py-1.5 border-b border-border bg-muted/50">
          <span className="text-[10px] text-muted-foreground font-medium">
            Sugerencias (opcional)
          </span>
        </div>
        <div className="max-h-[200px] overflow-y-auto overscroll-contain">
          {filteredEmpleados.map((empleado) => (
            <div
              key={empleado.id}
              onMouseDown={(e) => {
                e.preventDefault();
                e.stopPropagation();
                handleSelectEmpleado(empleado);
              }}
              className={cn(
                "flex items-center gap-2 px-3 py-2.5 cursor-pointer hover:bg-accent/80 transition-colors",
                isSelected(empleado) && "bg-accent"
              )}
            >
              <User className="h-4 w-4 text-muted-foreground flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="text-sm truncate text-foreground">{empleado.nombre}</div>
                <div className="text-xs text-muted-foreground truncate">
                  {empleado.cargo || "Sin cargo"}
                </div>
              </div>
              {isSelected(empleado) && (
                <Check className="h-4 w-4 text-primary flex-shrink-0" />
              )}
            </div>
          ))}
        </div>
      </div>
    );
  };

  // For empleadoId mode or BBM type: STRICT selector with search input
  if (useEmpleadoId || tipoPersonal === "BBM") {
    return (
      <div 
        ref={containerRef} 
        className={cn("relative w-full", className)}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Show warning if employee was deleted */}
        {empleadoDeleted && (
          <div className="absolute -top-6 left-0 right-0 flex items-center gap-1 text-[10px] text-destructive">
            <AlertCircle className="h-3 w-3" />
            <span>Empleado eliminado - selecciona otro</span>
          </div>
        )}
        
        {/* Search input */}
        <div className="relative w-full">
          {loading ? (
            <Loader2 className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground animate-spin pointer-events-none" />
          ) : (
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          )}
          <Input
            ref={inputRef}
            value={inputValue}
            onChange={handleInputChange}
            onFocus={handleFocus}
            onKeyDown={handleKeyDown}
            placeholder={resolvedDisplayValue || placeholder}
            className={cn(
              "h-9 pl-9 pr-8 text-sm w-full bg-background",
              empleadoDeleted && "border-destructive"
            )}
          />
          <ChevronDown className={cn(
            "absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground transition-transform pointer-events-none",
            isOpen && "rotate-180"
          )} />
        </div>

        {/* Relative position dropdown */}
        {renderDropdown()}
      </div>
    );
  }

  // For Proveedor/Transporte: FREE TEXT input with autocomplete suggestions
  return (
    <div 
      ref={containerRef} 
      className={cn("relative w-full", className)}
      onClick={(e) => e.stopPropagation()}
    >
      <Input
        ref={inputRef}
        value={inputValue}
        onChange={handleInputChange}
        onFocus={handleFocus}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className="h-9 text-sm w-full bg-background"
      />

      {/* Relative position dropdown */}
      {renderDropdown()}
    </div>
  );
}
