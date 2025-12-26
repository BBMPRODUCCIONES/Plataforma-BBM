import { useState, useMemo } from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { Building2, Check, Search, AlertCircle, Loader2, UserX } from "lucide-react";
import { useProveedores } from "@/contexts/ProveedoresContext";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";

interface ProveedorData {
  telefono?: string;
  correo?: string;
}

interface ProveedorAutocompleteProps {
  value: string;
  onChange: (value: string, proveedorId?: string, proveedorData?: ProveedorData) => void;
  placeholder?: string;
  className?: string;
}

const normalizeText = (text: string): string => {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
};

export function ProveedorAutocomplete({
  value,
  onChange,
  placeholder = "Buscar proveedor...",
  className,
}: ProveedorAutocompleteProps) {
  const { proveedores, loading } = useProveedores();
  const [open, setOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  // Find selected proveedor
  const selectedProveedor = useMemo(() => {
    if (!value) return null;
    return proveedores.find(p => p.id === value || p.nombre === value) || null;
  }, [value, proveedores]);

  // Check if selected proveedor was deleted
  const proveedorDeleted = useMemo(() => {
    return value && !selectedProveedor && proveedores.length > 0 && !loading;
  }, [value, selectedProveedor, proveedores.length, loading]);

  // Filter proveedores based on search
  const filteredProveedores = useMemo(() => {
    if (!searchTerm.trim()) return proveedores;
    const normalized = normalizeText(searchTerm);
    return proveedores.filter(prov => {
      const nombre = normalizeText(prov.nombre || "");
      const categoria = normalizeText(prov.categoria || "");
      const tipoProducto = normalizeText(prov.tipoProductoServicio || "");
      return nombre.includes(normalized) || categoria.includes(normalized) || tipoProducto.includes(normalized);
    });
  }, [proveedores, searchTerm]);

  const handleSelect = (proveedor: typeof proveedores[0]) => {
    onChange(proveedor.nombre, proveedor.id, {
      telefono: proveedor.telefono || undefined,
      correo: proveedor.correo || undefined,
    });
    setSearchTerm("");
    setOpen(false);
  };

  const displayValue = selectedProveedor?.nombre || (proveedorDeleted ? "Proveedor eliminado" : "");

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
            proveedorDeleted && "border-destructive text-destructive",
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
              placeholder="Buscar por nombre o categoría..."
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
            Solo proveedores de "Creación de Proveedores"
          </p>
        </div>

        {/* Proveedor list */}
        <div className="max-h-[250px] overflow-y-auto">
          {loading ? (
            <div className="p-6 text-center">
              <Loader2 className="h-8 w-8 mx-auto animate-spin text-primary" />
              <p className="text-sm text-muted-foreground mt-3">Cargando proveedores...</p>
            </div>
          ) : proveedores.length === 0 ? (
            <div className="p-6 text-center">
              <UserX className="h-10 w-10 mx-auto text-muted-foreground/40 mb-3" />
              <p className="text-sm font-medium text-foreground">No hay proveedores registrados</p>
              <p className="text-xs text-muted-foreground mt-1.5">
                Créelos primero en "Creación de Proveedores"
              </p>
            </div>
          ) : filteredProveedores.length === 0 ? (
            <div className="p-6 text-center">
              <Search className="h-10 w-10 mx-auto text-muted-foreground/40 mb-3" />
              <p className="text-sm font-medium text-foreground">Sin coincidencias</p>
              <p className="text-xs text-muted-foreground mt-1.5">
                Intenta con otro nombre o categoría
              </p>
            </div>
          ) : (
            filteredProveedores.map((proveedor) => (
              <div
                key={proveedor.id}
                onClick={() => handleSelect(proveedor)}
                className={cn(
                  "flex items-center gap-3 px-3 py-3 cursor-pointer hover:bg-accent transition-colors border-b border-border/50 last:border-b-0",
                  selectedProveedor?.id === proveedor.id && "bg-accent"
                )}
              >
                <div className="w-9 h-9 rounded-full bg-primary/15 flex items-center justify-center flex-shrink-0">
                  <Building2 className="h-4 w-4 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate text-foreground">{proveedor.nombre}</div>
                  <div className="text-xs text-muted-foreground truncate">
                    {proveedor.categoria || proveedor.tipoProductoServicio || "Sin categoría"}
                    {proveedor.telefono && ` • ${proveedor.telefono}`}
                  </div>
                </div>
                {selectedProveedor?.id === proveedor.id && (
                  <Check className="h-5 w-5 text-primary flex-shrink-0" />
                )}
              </div>
            ))
          )}
        </div>

        {/* Footer with count */}
        {proveedores.length > 0 && (
          <div className="px-3 py-2 border-t border-border bg-muted/30">
            <p className="text-[10px] text-muted-foreground text-center">
              {filteredProveedores.length} de {proveedores.length} proveedor{proveedores.length !== 1 ? "es" : ""}
            </p>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}

export default ProveedorAutocomplete;
