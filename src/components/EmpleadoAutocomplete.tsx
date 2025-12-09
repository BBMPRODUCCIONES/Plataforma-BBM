import { useState, useRef, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { User, Check, Search, AlertCircle, Loader2 } from "lucide-react";
import { useEmpleados } from "@/contexts/EmpleadosContext";

interface EmpleadoAutocompleteProps {
  value: string;
  onChange: (value: string, empleadoId?: string) => void;
  tipoPersonal: "BBM" | "Proveedor" | "Transporte";
  placeholder?: string;
  className?: string;
}

export function EmpleadoAutocomplete({
  value,
  onChange,
  tipoPersonal,
  placeholder = "Seleccionar personal...",
  className,
}: EmpleadoAutocompleteProps) {
  const { empleados, loading } = useEmpleados();
  const [isOpen, setIsOpen] = useState(false);
  const [inputValue, setInputValue] = useState(value || "");
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Filter employees by search term
  const searchTerm = inputValue.toLowerCase();
  const filteredEmpleados = empleados.filter(e =>
    e.nombre.toLowerCase().includes(searchTerm) ||
    (e.cargo && e.cargo.toLowerCase().includes(searchTerm))
  );

  // Close dropdown when clicking outside (same pattern as ClienteAutocomplete)
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        // Reset input if no valid selection for BBM
        if (tipoPersonal === "BBM" && !empleados.some(e => e.nombre === inputValue)) {
          setInputValue(value || "");
        }
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [inputValue, value, empleados, tipoPersonal]);

  // Sync input value when external value changes
  useEffect(() => {
    if (value !== inputValue && !isOpen) {
      setInputValue(value || "");
    }
  }, [value]);

  const handleSelectEmpleado = (empleado: typeof empleados[0]) => {
    onChange(empleado.nombre, empleado.id);
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
    if (tipoPersonal !== "BBM" && inputValue !== value) {
      onChange(inputValue);
    }
    // Delay close to allow click on dropdown items
    setTimeout(() => setIsOpen(false), 150);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      setIsOpen(false);
      inputRef.current?.blur();
    }
  };

  // For BBM type: STRICT selector with search input and dropdown
  if (tipoPersonal === "BBM") {
    return (
      <div 
        ref={containerRef} 
        className={cn("relative", className)}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search input - always visible */}
        <div className="relative">
          {loading ? (
            <Loader2 className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground animate-spin" />
          ) : (
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          )}
          <Input
            ref={inputRef}
            value={inputValue}
            onChange={handleInputChange}
            onFocus={() => setIsOpen(true)}
            onKeyDown={handleKeyDown}
            placeholder={value || placeholder}
            className="h-9 pl-9 pr-3 text-sm"
          />
        </div>

        {/* Dropdown - opens UPWARD to stay visible in modals */}
        {isOpen && (
          <div className="absolute z-50 bottom-full mb-1 w-full min-w-[280px] rounded-md border bg-popover shadow-lg">
            <div className="px-3 py-2 border-b border-border">
              <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                <AlertCircle className="h-3 w-3" />
                Empleados de "Creación de Empleados"
              </p>
            </div>
            <div className="max-h-[250px] overflow-y-auto">
              {filteredEmpleados.length === 0 ? (
                <div className="p-4 text-center">
                  <User className="h-8 w-8 mx-auto text-muted-foreground/50 mb-2" />
                  <p className="text-sm text-muted-foreground">
                    {empleados.length === 0 
                      ? "No hay empleados registrados" 
                      : "No se encontraron coincidencias"}
                  </p>
                  {empleados.length === 0 && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Créelos en "Creación de Empleados"
                    </p>
                  )}
                </div>
              ) : (
                filteredEmpleados.map((empleado) => (
                  <div
                    key={empleado.id}
                    onClick={() => handleSelectEmpleado(empleado)}
                    className={cn(
                      "flex items-center gap-3 px-3 py-2.5 cursor-pointer hover:bg-accent transition-colors",
                      value === empleado.nombre && "bg-accent"
                    )}
                  >
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <User className="h-4 w-4 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">{empleado.nombre}</div>
                      <div className="text-xs text-muted-foreground truncate">
                        {empleado.cargo || "BBM"}
                      </div>
                    </div>
                    {value === empleado.nombre && (
                      <Check className="h-4 w-4 text-primary flex-shrink-0" />
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    );
  }

  // For Proveedor/Transporte: FREE TEXT input with autocomplete suggestions
  return (
    <div 
      ref={containerRef} 
      className={cn("relative", className)}
      onClick={(e) => e.stopPropagation()}
    >
      <Input
        ref={inputRef}
        value={inputValue}
        onChange={handleInputChange}
        onFocus={() => setIsOpen(true)}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className="h-9 text-sm"
      />

      {/* Suggestions dropdown - opens UPWARD to stay visible in modals */}
      {isOpen && filteredEmpleados.length > 0 && (
        <div className="absolute z-50 bottom-full mb-1 w-full min-w-[250px] rounded-md border bg-popover shadow-lg">
          <div className="px-3 py-1.5 border-b border-border">
            <span className="text-[10px] text-muted-foreground">
              Sugerencias (opcional)
            </span>
          </div>
          <div className="max-h-[200px] overflow-y-auto">
            {filteredEmpleados.map((empleado) => (
              <div
                key={empleado.id}
                onClick={() => handleSelectEmpleado(empleado)}
                className={cn(
                  "flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-accent transition-colors",
                  inputValue === empleado.nombre && "bg-accent"
                )}
              >
                <User className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="text-sm truncate">{empleado.nombre}</div>
                  <div className="text-xs text-muted-foreground truncate">
                    {empleado.cargo || "Sin cargo"}
                  </div>
                </div>
                {inputValue === empleado.nombre && (
                  <Check className="h-4 w-4 text-primary flex-shrink-0" />
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
