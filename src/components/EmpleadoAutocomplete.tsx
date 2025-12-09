import { useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
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

interface DropdownPosition {
  top: number;
  left: number;
  width: number;
  openUpward: boolean;
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
  const [dropdownPosition, setDropdownPosition] = useState<DropdownPosition>({ 
    top: 0, 
    left: 0, 
    width: 300,
    openUpward: false 
  });
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

  // Calculate dropdown position when opening
  useEffect(() => {
    if (isOpen && containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const dropdownHeight = 320; // approximate max height
      const spaceBelow = window.innerHeight - rect.bottom;
      const spaceAbove = rect.top;
      const shouldOpenUpward = spaceBelow < dropdownHeight && spaceAbove > spaceBelow;

      setDropdownPosition({
        top: shouldOpenUpward ? rect.top - dropdownHeight - 4 : rect.bottom + 4,
        left: rect.left,
        width: Math.max(rect.width, 300),
        openUpward: shouldOpenUpward,
      });
    }
  }, [isOpen]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        // Check if click is on the portal dropdown
        const portalDropdown = document.getElementById("empleado-dropdown-portal");
        if (portalDropdown && portalDropdown.contains(event.target as Node)) {
          return;
        }
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Aggressive focus management for BBM input inside Dialog
  const forceFocus = useCallback(() => {
    if (inputRef.current && tipoPersonal === "BBM") {
      inputRef.current.focus();
      // Also set selection to end of input
      const len = inputRef.current.value.length;
      inputRef.current.setSelectionRange(len, len);
    }
  }, [tipoPersonal]);

  useEffect(() => {
    if (isOpen && tipoPersonal === "BBM") {
      // Use requestAnimationFrame to focus after Dialog's focus trap runs
      const rafId = requestAnimationFrame(() => {
        requestAnimationFrame(forceFocus);
      });
      return () => cancelAnimationFrame(rafId);
    }
  }, [isOpen, tipoPersonal, forceFocus]);

  const handleSelectEmpleado = (empleado: typeof empleadosFiltradosPorTipo[0]) => {
    onChange(empleado.nombre, empleado.id);
    setInputValue("");
    setIsOpen(false);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setInputValue(newValue);
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

  // Portal dropdown for BBM
  const renderBBMDropdown = () => {
    if (!isOpen) return null;

    return createPortal(
      <div
        id="empleado-dropdown-portal"
        data-radix-portal=""
        className="fixed z-[9999] bg-popover border border-border rounded-lg shadow-2xl overflow-hidden"
        style={{
          top: dropdownPosition.openUpward ? "auto" : dropdownPosition.top,
          bottom: dropdownPosition.openUpward ? window.innerHeight - dropdownPosition.top + 320 + 8 : "auto",
          left: dropdownPosition.left,
          width: dropdownPosition.width,
          maxHeight: 320,
        }}
        onPointerDown={(e) => {
          e.stopPropagation();
          e.preventDefault();
        }}
        onMouseDown={(e) => {
          e.stopPropagation();
        }}
        onClick={(e) => e.stopPropagation()}
        onFocus={(e) => e.stopPropagation()}
      >
        {/* Search header */}
        <div className="p-3 border-b border-border bg-card sticky top-0">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            <input
              ref={inputRef}
              type="text"
              value={inputValue}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              placeholder="Buscar empleado..."
              className="flex h-9 w-full rounded-md border border-input bg-muted px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring pl-10 pr-3"
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck={false}
              tabIndex={-1}
            />
          </div>
          <p className="text-[10px] text-muted-foreground mt-2 flex items-center gap-1">
            <AlertCircle className="h-3 w-3" />
            Empleados de "Creación de Empleados"
          </p>
        </div>

        {/* Results list */}
        <div className="overflow-y-auto max-h-[220px]">
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
      </div>,
      document.body
    );
  };

  // Portal dropdown for Proveedor/Transporte
  const renderSuggestionsDropdown = () => {
    if (!isOpen) return null;

    return createPortal(
      <div
        id="empleado-dropdown-portal"
        data-radix-portal=""
        className="fixed z-[9999] bg-popover border border-border rounded-lg shadow-2xl overflow-hidden"
        style={{
          top: dropdownPosition.openUpward ? "auto" : dropdownPosition.top,
          bottom: dropdownPosition.openUpward ? window.innerHeight - dropdownPosition.top + 280 + 8 : "auto",
          left: dropdownPosition.left,
          width: dropdownPosition.width,
          maxHeight: 280,
        }}
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-3 py-2 border-b border-border bg-card/50">
          <span className="text-[11px] text-muted-foreground font-medium">
            Sugerencias (opcional - puede escribir manualmente)
          </span>
        </div>

        {/* Results */}
        <div className="overflow-y-auto max-h-[220px]">
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
      </div>,
      document.body
    );
  };

  // For BBM type: STRICT selector - MUST select from employee list (no manual entry)
  if (tipoPersonal === "BBM") {
    return (
      <div ref={containerRef} className={cn("relative", className)}>
        <div
          onPointerDown={(e) => {
            e.preventDefault();
            e.stopPropagation();
            // Use setTimeout to avoid Dialog's focus trap interference
            setTimeout(() => setIsOpen(!isOpen), 0);
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
        {renderBBMDropdown()}
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
      {renderSuggestionsDropdown()}
    </div>
  );
}
