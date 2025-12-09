import { useState, useRef, useEffect, useCallback } from "react";
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

interface DropdownPosition {
  top?: number;
  bottom?: number;
  left: number;
  width: number;
  openDirection: 'up' | 'down';
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
  const [dropdownPosition, setDropdownPosition] = useState<DropdownPosition | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Filter employees by search term
  const searchTerm = inputValue.toLowerCase();
  const filteredEmpleados = empleados.filter(e =>
    e.nombre.toLowerCase().includes(searchTerm) ||
    (e.cargo && e.cargo.toLowerCase().includes(searchTerm))
  );

  // Calculate dropdown position dynamically
  const calculatePosition = useCallback(() => {
    if (!containerRef.current) return;
    
    const rect = containerRef.current.getBoundingClientRect();
    const viewportHeight = window.innerHeight;
    const dropdownHeight = 300; // Max height of dropdown
    
    const spaceBelow = viewportHeight - rect.bottom;
    const spaceAbove = rect.top;
    
    // Prefer opening downward if there's enough space, otherwise open upward
    const openDirection = spaceBelow >= dropdownHeight || spaceBelow >= spaceAbove ? 'down' : 'up';
    
    if (openDirection === 'down') {
      setDropdownPosition({
        top: rect.bottom + 4,
        left: rect.left,
        width: Math.max(rect.width, 280),
        openDirection: 'down'
      });
    } else {
      setDropdownPosition({
        bottom: viewportHeight - rect.top + 4,
        left: rect.left,
        width: Math.max(rect.width, 280),
        openDirection: 'up'
      });
    }
  }, []);

  // Recalculate position when opening or on scroll/resize
  useEffect(() => {
    if (isOpen) {
      calculatePosition();
      
      const handleScrollOrResize = () => calculatePosition();
      window.addEventListener('scroll', handleScrollOrResize, true);
      window.addEventListener('resize', handleScrollOrResize);
      
      return () => {
        window.removeEventListener('scroll', handleScrollOrResize, true);
        window.removeEventListener('resize', handleScrollOrResize);
      };
    }
  }, [isOpen, calculatePosition]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (containerRef.current && !containerRef.current.contains(target)) {
        // Also check if clicking on the dropdown itself (which is in a portal)
        const dropdownEl = document.getElementById('empleado-dropdown-portal');
        if (dropdownEl && dropdownEl.contains(target)) {
          return; // Don't close if clicking inside dropdown
        }
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
    calculatePosition();
  };

  // Render dropdown using fixed positioning to escape modal constraints
  const renderDropdown = () => {
    if (!isOpen || !dropdownPosition) return null;

    const dropdownStyle: React.CSSProperties = {
      position: 'fixed',
      left: dropdownPosition.left,
      width: dropdownPosition.width,
      zIndex: 9999,
      ...(dropdownPosition.openDirection === 'down' 
        ? { top: dropdownPosition.top } 
        : { bottom: dropdownPosition.bottom }
      ),
    };

    if (tipoPersonal === "BBM") {
      return (
        <div 
          id="empleado-dropdown-portal"
          style={dropdownStyle}
          className="rounded-md border bg-popover shadow-xl"
        >
          <div className="px-3 py-2 border-b border-border bg-muted/30">
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
                  onMouseDown={(e) => {
                    e.preventDefault();
                    handleSelectEmpleado(empleado);
                  }}
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
      );
    }

    // For Proveedor/Transporte suggestions
    if (filteredEmpleados.length === 0) return null;

    return (
      <div 
        id="empleado-dropdown-portal"
        style={dropdownStyle}
        className="rounded-md border bg-popover shadow-xl"
      >
        <div className="px-3 py-1.5 border-b border-border bg-muted/30">
          <span className="text-[10px] text-muted-foreground">
            Sugerencias (opcional)
          </span>
        </div>
        <div className="max-h-[200px] overflow-y-auto">
          {filteredEmpleados.map((empleado) => (
            <div
              key={empleado.id}
              onMouseDown={(e) => {
                e.preventDefault();
                handleSelectEmpleado(empleado);
              }}
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
    );
  };

  // For BBM type: STRICT selector with search input
  if (tipoPersonal === "BBM") {
    return (
      <div 
        ref={containerRef} 
        className={cn("relative", className)}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search input */}
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
            onFocus={handleFocus}
            onKeyDown={handleKeyDown}
            placeholder={value || placeholder}
            className="h-9 pl-9 pr-3 text-sm"
          />
        </div>

        {/* Fixed position dropdown */}
        {renderDropdown()}
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
        onFocus={handleFocus}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className="h-9 text-sm"
      />

      {/* Fixed position dropdown */}
      {renderDropdown()}
    </div>
  );
}
