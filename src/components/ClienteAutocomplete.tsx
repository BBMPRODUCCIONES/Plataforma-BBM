import { useState, useRef, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { mockClientes } from "@/data/mockData";
import { cn } from "@/lib/utils";
import { Check, Search } from "lucide-react";

interface ClienteAutocompleteProps {
  value: string;
  onChange: (value: string) => void;
  className?: string;
}

export function ClienteAutocomplete({ value, onChange, className }: ClienteAutocompleteProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState(value || "");
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Filter clients based on search
  const filteredClientes = mockClientes.filter((cliente) =>
    cliente.nombre.toLowerCase().includes(search.toLowerCase()) ||
    cliente.nit.includes(search)
  );

  // Handle click outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        // Reset search to current value if user clicks away without selecting
        if (!mockClientes.some(c => c.nombre === search)) {
          setSearch(value || "");
        }
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [search, value]);

  // Update search when value changes externally
  useEffect(() => {
    setSearch(value || "");
  }, [value]);

  const handleSelect = (clienteName: string) => {
    setSearch(clienteName);
    onChange(clienteName);
    setIsOpen(false);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearch(e.target.value);
    setIsOpen(true);
  };

  const handleFocus = () => {
    setIsOpen(true);
  };

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
        <Input
          ref={inputRef}
          value={search}
          onChange={handleInputChange}
          onFocus={handleFocus}
          placeholder="Buscar cliente..."
          className={cn("h-8 pl-7 pr-2 text-sm", className)}
        />
      </div>
      
      {isOpen && (
        <div className="absolute z-50 mt-1 w-full min-w-[200px] rounded-md border bg-popover shadow-lg">
          <div className="max-h-[200px] overflow-y-auto">
            {filteredClientes.length === 0 ? (
              <div className="px-3 py-2 text-sm text-muted-foreground">
                No se encontraron clientes
              </div>
            ) : (
              filteredClientes.map((cliente) => (
                <div
                  key={cliente.id}
                  onClick={() => handleSelect(cliente.nombre)}
                  className={cn(
                    "flex items-center justify-between px-3 py-2 cursor-pointer hover:bg-accent text-sm",
                    value === cliente.nombre && "bg-accent"
                  )}
                >
                  <div>
                    <div className="font-medium">{cliente.nombre}</div>
                    <div className="text-xs text-muted-foreground">NIT: {cliente.nit}</div>
                  </div>
                  {value === cliente.nombre && (
                    <Check className="h-4 w-4 text-primary" />
                  )}
                </div>
              ))
            )}
          </div>
          {filteredClientes.length > 0 && (
            <div className="border-t px-3 py-1.5 text-xs text-muted-foreground">
              {filteredClientes.length} cliente(s) encontrado(s)
            </div>
          )}
        </div>
      )}
    </div>
  );
}
