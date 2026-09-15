import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Loader2, X } from "lucide-react";
import { useClientes } from "@/contexts/ClientesContext";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface NuevoClienteInlineProps {
  /** Nombre con el que arranca el campo (lo que el usuario ya habia escrito). */
  nombreInicial?: string;
  /** Se llama con el nombre del cliente ya creado, o del que ya existia. */
  onCreado: (nombre: string) => void;
  onCancelar: () => void;
  className?: string;
}

/**
 * Formulario chico para crear un cliente sin salir del formulario del evento.
 * Va dentro del mismo dialogo, no abre otro: asi no hay que pelear con el
 * foco ni con dialogos encima de dialogos.
 */
export function NuevoClienteInline({
  nombreInicial = "",
  onCreado,
  onCancelar,
  className,
}: NuevoClienteInlineProps) {
  const { clientes, addCliente } = useClientes();
  const [nombre, setNombre] = useState(nombreInicial);
  const [nit, setNit] = useState("");
  const [guardando, setGuardando] = useState(false);

  const guardar = async () => {
    const limpio = nombre.trim();
    if (!limpio) {
      toast.error("Escribe el nombre del cliente");
      return;
    }

    // Si ya existe uno con ese nombre, no creamos un duplicado: lo elegimos.
    const repetido = clientes.find(
      (c) => c.nombre.trim().toLowerCase() === limpio.toLowerCase()
    );
    if (repetido) {
      toast.info(`"${repetido.nombre}" ya estaba registrado. Lo seleccioné.`);
      onCreado(repetido.nombre);
      return;
    }

    setGuardando(true);
    const creado = await addCliente({ nombre: limpio, nit: nit.trim() });
    setGuardando(false);

    if (creado) {
      toast.success(`Cliente "${creado.nombre}" creado`);
      onCreado(creado.nombre);
    }
    // Si falla, addCliente ya avisa y revierte.
  };

  const alTeclear = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      guardar();
    } else if (e.key === "Escape") {
      e.preventDefault();
      onCancelar();
    }
  };

  return (
    <div
      className={cn("rounded-md border border-border bg-muted/40 p-3 space-y-3", className)}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">Nuevo cliente</span>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          aria-label="Cancelar"
          onClick={onCancelar}
          disabled={guardando}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <div className="space-y-1">
          <Label htmlFor="nuevo-cliente-nombre" className="text-xs">
            Nombre *
          </Label>
          <Input
            id="nuevo-cliente-nombre"
            autoFocus
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            onKeyDown={alTeclear}
            placeholder="Nombre del cliente"
            className="h-9"
            disabled={guardando}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="nuevo-cliente-nit" className="text-xs">
            NIT
          </Label>
          <Input
            id="nuevo-cliente-nit"
            value={nit}
            onChange={(e) => setNit(e.target.value)}
            onKeyDown={alTeclear}
            placeholder="Opcional"
            className="h-9"
            disabled={guardando}
          />
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Button type="button" size="sm" onClick={guardar} disabled={guardando}>
          {guardando && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
          Crear y usar
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={onCancelar}
          disabled={guardando}
        >
          Cancelar
        </Button>
        <span className="ml-auto text-[11px] text-muted-foreground">
          El NIT lo puedes completar después
        </span>
      </div>
    </div>
  );
}
