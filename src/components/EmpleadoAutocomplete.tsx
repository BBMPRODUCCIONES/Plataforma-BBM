import { useState, useRef, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { User, Check, ChevronDown, Search, AlertCircle } from "lucide-react";
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
  const { empleados } = useEmpleados();
  const [isOpen, setIsOpen] = useState(false);
  const [inputValue, setInputValue] = useState(value || "");
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // For BBM: Show ALL employees from "Creación de Empleados"
  // For others: Show all employees as suggestions
  const empleadosFiltradosPorTipo = empleados;

  // Filter by search input
  const searchTerm = tipoPersonal === "BBM" ? inputValue : value;
  const filteredEmpleados = empleadosFiltradosPorTipo.filter(e =>
    e.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (e.cargo && e.cargo.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  // NOTE: Removed useEffect that synced inputValue with value - it caused input to "erase" while typing
  // For free text mode (Proveedor/Transporte), we use local state and sync only on blur

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (isOpen && inputRef.current && tipoPersonal === "BBM") {
      inputRef.current.focus();
    }
  }, [isOpen, tipoPersonal]);

  const handleSelectEmpleado = (empleado: typeof empleadosFiltradosPorTipo[0]) => {
    onChange(empleado.nombre, empleado.id);
    setInputValue("");
    setIsOpen(false);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setInputValue(newValue);
    // Don't call onChange on every keystroke for free text - only on blur
  };

  const handleBlur = () => {
    if (tipoPersonal !== "BBM" && inputValue !== value) {
      onChange(inputValue);
    }
    // Small delay before closing to allow click on suggestions
    setTimeout(() => setIsOpen(false), 150);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      setIsOpen(false);
    }
  };

  // For BBM type: STRICT selector - MUST select from employee list (no manual entry)
  if (tipoPersonal === "BBM") {
    return (
      <div ref={containerRef} className={cn("relative", className)}>
        <div
          onClick={(e) => {
            e.stopPropagation();
            setIsOpen(!isOpen);
          }}
          className={cn(
            "flex items-center justify-between h-9 px-3 text-sm bg-muted border border-border rounded-md cursor-pointer hover:bg-muted/80 transition-colors",
            isOpen && "ring-2 ring-primary/50 border-primary"
          )}
        >
          <span className={cn(
            "truncate",
            !value && "text-muted-foreground"
          )}>
            {value || placeholder}
          </span>
          <ChevronDown className={cn(
            "h-4 w-4 text-muted-foreground transition-transform flex-shrink-0 ml-2",
            isOpen && "rotate-180"
          )} />
        </div>

        {isOpen && (
          <div 
            className="absolute z-[9999] mt-1 w-full min-w-[300px] bg-popover border border-border rounded-lg shadow-xl max-h-72 overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Search header */}
            <div className="p-3 border-b border-border bg-card sticky top-0">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  ref={inputRef}
                  value={inputValue}
                  onChange={handleInputChange}
                  onKeyDown={handleKeyDown}
                  placeholder="Buscar empleado..."
                  className="h-9 text-sm bg-muted pl-10 pr-3"
                  autoFocus
                  onClick={(e) => e.stopPropagation()}
                />
              </div>
              <p className="text-[10px] text-muted-foreground mt-2 flex items-center gap-1">
                <AlertCircle className="h-3 w-3" />
                Empleados de "Creación de Empleados"
              </p>
            </div>

            {/* Results list - show at least 5-6 items */}
            <div className="overflow-y-auto max-h-80 min-h-[120px]">
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
                        "flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-primary/10 transition-colors border-b border-border/50 last:border-b-0",
                        value === empleado.nombre && "bg-primary/15"
                      )}
                    >
                      <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                        <User className="h-4 w-4 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium truncate">{empleado.nombre}</div>
                        <div className="text-xs text-muted-foreground truncate flex items-center gap-2">
                          <span className="bg-primary/10 text-primary px-1.5 py-0.5 rounded text-[10px] font-medium">
                            {empleado.cargo || "BBM"}
                          </span>
                          {empleado.telefono && (
                            <span>• {empleado.telefono}</span>
                          )}
                        </div>
                      </div>
                      {value === empleado.nombre && (
                        <Check className="h-4 w-4 text-primary flex-shrink-0" />
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-6 text-center">
                  <User className="h-10 w-10 mx-auto text-muted-foreground/50 mb-3" />
                  <p className="text-sm text-muted-foreground font-medium">
                    {inputValue 
                      ? "No se encontraron coincidencias" 
                      : "No hay empleados registrados"}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Cree empleados en el módulo "Creación de Empleados"
                  </p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    );
  }

  // For Proveedor/Transporte: FREE TEXT input with autocomplete suggestions
  return (
    <div ref={containerRef} className={cn("relative", className)}>
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

      {isOpen && (
        <div 
          className="absolute z-[9999] mt-1 w-full min-w-[280px] bg-popover border border-border rounded-lg shadow-xl max-h-56 overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="px-3 py-2 border-b border-border bg-card/50">
            <span className="text-[11px] text-muted-foreground font-medium">
              Sugerencias (opcional - puede escribir manualmente)
            </span>
          </div>

          {/* Results */}
          <div className="overflow-y-auto max-h-64 min-h-[100px]">
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
                      "flex items-center gap-3 px-4 py-2.5 cursor-pointer hover:bg-primary/10 transition-colors",
                      inputValue === empleado.nombre && "bg-primary/15"
                    )}
                  >
                    <div className="w-7 h-7 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
                      <User className="h-3.5 w-3.5 text-muted-foreground" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">{empleado.nombre}</div>
                      <div className="text-xs text-muted-foreground truncate">
                        {empleado.cargo || "Sin cargo especificado"}
                      </div>
                    </div>
                    {inputValue === empleado.nombre && (
                      <Check className="h-4 w-4 text-primary flex-shrink-0" />
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-4 text-center">
                <p className="text-xs text-muted-foreground">
                  {inputValue 
                    ? "No se encontraron coincidencias"
                    : "Escriba para agregar personal o buscar sugerencias"}
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
