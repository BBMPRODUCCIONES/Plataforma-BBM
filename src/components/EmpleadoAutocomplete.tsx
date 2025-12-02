import { useState, useRef, useEffect, useMemo } from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { Check, User, ChevronDown } from "lucide-react";
import { useEmpleados, Empleado } from "@/contexts/EmpleadosContext";

interface EmpleadoAutocompleteProps {
  value: string;
  onChange: (value: string) => void;
  tipoPersonal: "BBM" | "Proveedor" | "Transporte";
  className?: string;
}

export function EmpleadoAutocomplete({ 
  value, 
  onChange, 
  tipoPersonal,
  className 
}: EmpleadoAutocompleteProps) {
  const { getEmpleadosByCategoria } = useEmpleados();
  const [isOpen, setIsOpen] = useState(false);
  const [inputValue, setInputValue] = useState(value || "");
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Determine if this is a BBM-only selector (no manual entry)
  const isBBMRestricted = tipoPersonal === "BBM";

  // Get empleados by category from context
  const empleadosByCategory = useMemo(() => {
    return getEmpleadosByCategoria(tipoPersonal);
  }, [getEmpleadosByCategoria, tipoPersonal]);

  // Filter empleados based on search
  const filteredEmpleados = useMemo(() => {
    if (!inputValue.trim()) return empleadosByCategory;
    
    return empleadosByCategory.filter(e =>
      e.nombre.toLowerCase().includes(inputValue.toLowerCase())
    );
  }, [inputValue, empleadosByCategory]);

  useEffect(() => {
    setInputValue(value || "");
  }, [value]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        // If BBM and value doesn't match any empleado, reset
        if (isBBMRestricted) {
          const matchedEmpleado = empleadosByCategory.find(
            e => e.nombre === inputValue
          );
          if (!matchedEmpleado && inputValue !== value) {
            setInputValue(value || "");
          }
        }
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isBBMRestricted, inputValue, value, empleadosByCategory]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setInputValue(newValue);
    setIsOpen(true);

    // For Proveedor and Transporte, allow free text entry
    if (!isBBMRestricted) {
      onChange(newValue);
    }
  };

  const handleSelectEmpleado = (empleado: Empleado) => {
    setInputValue(empleado.nombre);
    onChange(empleado.nombre);
    setIsOpen(false);
  };

  const handleFocus = () => {
    setIsOpen(true);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      setIsOpen(false);
    }
    if (e.key === "Enter" && filteredEmpleados.length > 0 && isBBMRestricted) {
      e.preventDefault();
      handleSelectEmpleado(filteredEmpleados[0]);
    }
  };

  // For BBM: Show dropdown selector style (MANDATORY selection)
  if (isBBMRestricted) {
    return (
      <div ref={containerRef} className={cn("relative", className)}>
        <div
          onClick={() => setIsOpen(!isOpen)}
          className={cn(
            "flex items-center justify-between px-2 py-1 text-xs cursor-pointer rounded border border-transparent",
            "hover:bg-muted/50 transition-colors",
            isOpen && "border-primary/50 bg-muted/30"
          )}
        >
          <div className="flex items-center gap-2 truncate">
            <User className="h-3 w-3 text-muted-foreground flex-shrink-0" />
            <span className={value ? "" : "text-muted-foreground"}>
              {value || "Seleccionar empleado BBM..."}
            </span>
          </div>
          <ChevronDown className={cn(
            "h-3 w-3 text-muted-foreground transition-transform",
            isOpen && "rotate-180"
          )} />
        </div>

        {isOpen && (
          <div 
            className="absolute z-[9999] mt-1 w-full min-w-[250px] bg-popover border border-border rounded-md shadow-xl max-h-48 overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-2 border-b border-border bg-background">
              <Input
                ref={inputRef}
                value={inputValue}
                onChange={handleInputChange}
                onKeyDown={handleKeyDown}
                placeholder="Buscar empleado BBM..."
                className="h-8 text-xs bg-muted"
                autoFocus
                onClick={(e) => e.stopPropagation()}
              />
            </div>
            {filteredEmpleados.length > 0 ? (
              <div className="py-1">
                {filteredEmpleados.map((empleado) => (
                  <div
                    key={empleado.id}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleSelectEmpleado(empleado);
                    }}
                    className={cn(
                      "flex items-center gap-2 px-3 py-2.5 cursor-pointer hover:bg-primary/10 transition-colors",
                      value === empleado.nombre && "bg-primary/20"
                    )}
                  >
                    <User className="h-4 w-4 text-primary" />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">{empleado.nombre}</div>
                      <div className="text-xs text-muted-foreground truncate">
                        {empleado.telefono}
                      </div>
                    </div>
                    {value === empleado.nombre && (
                      <Check className="h-4 w-4 text-primary flex-shrink-0" />
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="px-3 py-4 text-center">
                <p className="text-xs text-muted-foreground">
                  No hay empleados BBM registrados
                </p>
                <p className="text-[10px] text-muted-foreground mt-1">
                  Agregue empleados en el módulo "Creación de Empleados"
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  // For Proveedor/Transporte: Allow free text with suggestions
  return (
    <div ref={containerRef} className={cn("relative", className)}>
      <Input
        ref={inputRef}
        value={inputValue}
        onChange={handleInputChange}
        onFocus={handleFocus}
        onKeyDown={handleKeyDown}
        placeholder={tipoPersonal === "Transporte" ? "Nombre del transportista..." : "Nombre del proveedor..."}
        className="h-7 text-xs"
      />

      {isOpen && filteredEmpleados.length > 0 && (
        <div 
          className="absolute z-[9999] mt-1 w-full min-w-[200px] bg-popover border border-border rounded-md shadow-xl max-h-40 overflow-y-auto"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="px-2 py-1 border-b border-border bg-muted/30">
            <span className="text-[10px] text-muted-foreground">
              Sugerencias (opcional)
            </span>
          </div>
          <div className="py-1">
            {filteredEmpleados.map((empleado) => (
              <div
                key={empleado.id}
                onClick={(e) => {
                  e.stopPropagation();
                  handleSelectEmpleado(empleado);
                }}
                className={cn(
                  "flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-primary/10 transition-colors",
                  value === empleado.nombre && "bg-primary/20"
                )}
              >
                <User className="h-3 w-3 text-muted-foreground" />
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-medium truncate">{empleado.nombre}</div>
                  <div className="text-[10px] text-muted-foreground truncate">
                    {empleado.telefono}
                  </div>
                </div>
                {value === empleado.nombre && (
                  <Check className="h-3 w-3 text-primary flex-shrink-0" />
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
