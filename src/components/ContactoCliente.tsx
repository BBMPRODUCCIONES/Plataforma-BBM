import { useState } from "react";
import { MessageCircle, Phone, User } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Project } from "@/types";
import { cn } from "@/lib/utils";

/**
 * Contacto del cliente en la tabla: nombre y celular, con botones para
 * llamar y abrir WhatsApp. Quien puede editar el evento lo cambia aqui.
 */
export const soloDigitos = (t?: string) => (t || "").replace(/[^\d]/g, "");
/** WhatsApp necesita el indicativo: a los celulares colombianos de 10 digitos se les pone 57. */
export const enlaceWhatsApp = (t?: string) => {
  const d = soloDigitos(t);
  if (!d) return "";
  return `https://wa.me/${d.length === 10 ? `57${d}` : d}`;
};

export function ContactoCliente({
  proyecto,
  soloLectura = false,
  onGuardar,
}: {
  proyecto: Project;
  soloLectura?: boolean;
  onGuardar: (cambios: Partial<Project>) => Promise<void> | void;
}) {
  const [abierto, setAbierto] = useState(false);
  const [nombre, setNombre] = useState(proyecto.contactoNombre || "");
  const [telefono, setTelefono] = useState(proyecto.contactoTelefono || "");
  const tiene = Boolean(proyecto.contactoNombre || proyecto.contactoTelefono);
  const tel = soloDigitos(proyecto.contactoTelefono);

  return (
    <Popover
      open={abierto}
      onOpenChange={(v) => {
        setAbierto(v);
        if (v) {
          setNombre(proyecto.contactoNombre || "");
          setTelefono(proyecto.contactoTelefono || "");
        }
      }}
    >
      <PopoverTrigger asChild>
        <button
          type="button"
          onClick={(e) => e.stopPropagation()}
          className={cn(
            "flex w-full min-w-0 flex-col items-start rounded px-1.5 py-0.5 text-left text-xs hover:bg-muted/50",
            !tiene && "text-muted-foreground"
          )}
          title={tiene ? `${proyecto.contactoNombre || ""} ${proyecto.contactoTelefono || ""}` : "Sin contacto"}
        >
          {tiene ? (
            <>
              <span className="w-full truncate">{proyecto.contactoNombre || "—"}</span>
              {proyecto.contactoTelefono && (
                <span className="w-full truncate font-mono text-[11px] text-muted-foreground">{proyecto.contactoTelefono}</span>
              )}
            </>
          ) : (
            <span>{soloLectura ? "Sin contacto" : "+ Contacto"}</span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-72 space-y-3 p-3" align="start" onClick={(e) => e.stopPropagation()}>
        <p className="text-sm font-semibold">Contacto del cliente</p>
        {tel && (
          <div className="flex gap-2">
            <Button asChild size="sm" variant="outline" className="h-8 flex-1 gap-1 text-xs">
              <a href={`tel:${tel}`}><Phone className="h-3.5 w-3.5" /> Llamar</a>
            </Button>
            <Button asChild size="sm" variant="outline" className="h-8 flex-1 gap-1 text-xs">
              <a href={enlaceWhatsApp(proyecto.contactoTelefono)} target="_blank" rel="noopener noreferrer">
                <MessageCircle className="h-3.5 w-3.5" /> WhatsApp
              </a>
            </Button>
          </div>
        )}
        {soloLectura ? (
          !tiene && <p className="text-xs text-muted-foreground">Este evento no tiene contacto cargado.</p>
        ) : (
          <>
            <div className="space-y-1">
              <Label className="text-xs">Nombre</Label>
              <div className="relative">
                <User className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input value={nombre} onChange={(e) => setNombre(e.target.value)} className="h-8 pl-7 text-xs" placeholder="Persona de contacto" />
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Celular</Label>
              <Input value={telefono} onChange={(e) => setTelefono(e.target.value)} className="h-8 text-xs" type="tel" inputMode="tel" placeholder="Ej: 314 277 7773" />
            </div>
            <Button
              size="sm"
              className="h-8 w-full"
              onClick={async () => {
                await onGuardar({ contactoNombre: nombre.trim(), contactoTelefono: telefono.trim() });
                setAbierto(false);
              }}
            >
              Guardar contacto
            </Button>
          </>
        )}
      </PopoverContent>
    </Popover>
  );
}
