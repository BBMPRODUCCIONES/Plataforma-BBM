import { useState, useRef, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { User, Check, ChevronDown, Search } from "lucide-react";
import { useEmpleados } from "@/contexts/EmpleadosContext";

interface EmpleadoAutocompleteProps {
  value: string;
  onChange: (value: string) => void;
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
  const [inputValue, setInputValue] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // All employees are available for BBM selection
  const empleadosDisponibles = empleados;

  const filteredEmpleados = empleadosDisponibles.filter(e =>
    e.nombre.toLowerCase().includes(inputValue.toLowerCase()) ||
    (e.cargo && e.cargo.toLowerCase().includes(inputValue.toLowerCase()))
  );

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

  const handleSelectEmpleado = (empleado: typeof empleadosDisponibles[0]) => {
    onChange(empleado.nombre);
    setInputValue("");
    setIsOpen(false);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(e.target.value);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      setIsOpen(false);
    }
  };

  // For BBM type: restricted selector - MUST select from employee list
  if (tipoPersonal === "BBM") {
    return (
      <div ref={containerRef} className={cn("relative", className)}>
        <div
          onClick={(e) => {
            e.stopPropagation();
            setIsOpen(!isOpen);
          }}
          className={cn(
            "flex items-center justify-between h-8 px-3 text-xs bg-muted border border-border rounded cursor-pointer hover:bg-muted/80 transition-colors",
            isOpen && "ring-2 ring-primary/50"
          )}
        >
          <span className={cn(
            "truncate",
            !value && "text-muted-foreground"
          )}>
            {value || placeholder}
          </span>
          <ChevronDown className={cn(
            "h-4 w-4 text-muted-foreground transition-transform flex-shrink-0",
            isOpen && "rotate-180"
          )} />
        </div>

        {isOpen && (
          <div 
            className="absolute z-[9999] mt-1 w-full min-w-[280px] bg-popover border border-border rounded-md shadow-xl max-h-64 overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-2 border-b border-border bg-background sticky top-0">
              <div className="relative">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  ref={inputRef}
                  value={inputValue}
                  onChange={handleInputChange}
                  onKeyDown={handleKeyDown}
                  placeholder="Buscar empleado..."
                  className="h-8 text-xs bg-muted pl-8"
                  autoFocus
                  onClick={(e) => e.stopPropagation()}
                />
              </div>
            </div>
            <div className="overflow-y-auto max-h-48">
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
                        "flex items-center gap-3 px-3 py-2.5 cursor-pointer hover:bg-primary/10 transition-colors",
                        value === empleado.nombre && "bg-primary/20"
                      )}
                    >
                      <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                        <User className="h-4 w-4 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium truncate">{empleado.nombre}</div>
                        <div className="text-xs text-muted-foreground truncate">
                          {empleado.cargo || "Sin cargo"} • {empleado.telefono || "Sin teléfono"}
                        </div>
                      </div>
                      {value === empleado.nombre && (
                        <Check className="h-4 w-4 text-primary flex-shrink-0" />
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-4 text-center">
                  <User className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                  <p className="text-xs text-muted-foreground">
                    {inputValue 
                      ? "No se encontraron empleados" 
                      : "No hay empleados registrados"}
                  </p>
                  <p className="text-[10px] text-muted-foreground mt-1">
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

  // For Proveedor/Transporte: free text with suggestions
  return (
    <div ref={containerRef} className={cn("relative", className)}>
      <Input
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setIsOpen(true);
        }}
        onFocus={() => setIsOpen(true)}
        placeholder={placeholder}
        className="h-8 text-xs"
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
                    {empleado.cargo || "Sin cargo"}
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
