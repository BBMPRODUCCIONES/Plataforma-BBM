import { useEffect, useMemo, useState } from "react";
import { Plus, Trash2, Loader2, Receipt } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { EmpleadoAutocomplete } from "@/components/EmpleadoAutocomplete";
import { ProveedorAutocomplete } from "@/components/ProveedorAutocomplete";
import { CostoEvento, Project, TipoCosto } from "@/types";
import { toast } from "@/hooks/use-toast";

interface CostosEventoDialogProps {
  proyecto: Project | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onGuardar: (costos: CostoEvento[]) => Promise<void>;
  /** Sin permiso de editar Directivo se puede mirar, no tocar. */
  soloLectura?: boolean;
}

const TIPOS: { valor: TipoCosto; nombre: string }[] = [
  { valor: "personal", nombre: "Personal" },
  { valor: "proveedor", nombre: "Proveedor" },
  { valor: "transporte", nombre: "Transporte" },
  { valor: "alquiler", nombre: "Alquiler de equipos" },
  { valor: "produccion", nombre: "Producción" },
  { valor: "alimentacion", nombre: "Alimentación" },
  { valor: "otro", nombre: "Otro" },
];

const pesos = new Intl.NumberFormat("es-CO", {
  style: "currency",
  currency: "COP",
  maximumFractionDigits: 0,
});

const nombreDeTipo = (t: TipoCosto) => TIPOS.find((x) => x.valor === t)?.nombre ?? t;

function lineaNueva(): CostoEvento {
  return {
    id: `costo-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    tipo: "proveedor",
    concepto: "",
    beneficiario: "",
    valor: 0,
    creadoEn: new Date().toISOString(),
  };
}

/**
 * Costos reales del evento: a quien se le pago y cuanto.
 *
 * Es el otro lado del Ingreso Total, que hasta ahora estaba solo: se sabia lo
 * que entraba y no lo que salia, asi que la utilidad habia que sacarla aparte.
 */
export function CostosEventoDialog({
  proyecto,
  open,
  onOpenChange,
  onGuardar,
  soloLectura = false,
}: CostosEventoDialogProps) {
  const [lineas, setLineas] = useState<CostoEvento[]>([]);
  const [guardando, setGuardando] = useState(false);

  // Cada apertura parte de lo que hay guardado, no de lo que quedo en pantalla
  // la vez anterior.
  useEffect(() => {
    if (open) setLineas(proyecto?.costos ? [...proyecto.costos] : []);
  }, [open, proyecto]);

  const total = useMemo(
    () => lineas.reduce((suma, l) => suma + (Number(l.valor) || 0), 0),
    [lineas]
  );

  const porTipo = useMemo(() => {
    const mapa = new Map<TipoCosto, number>();
    lineas.forEach((l) => {
      mapa.set(l.tipo, (mapa.get(l.tipo) || 0) + (Number(l.valor) || 0));
    });
    return [...mapa.entries()].filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]);
  }, [lineas]);

  const ingreso = Number(proyecto?.ingresoTotal) || 0;
  const utilidad = ingreso - total;
  const margen = ingreso > 0 ? (utilidad / ingreso) * 100 : null;

  const cambiar = (id: string, cambios: Partial<CostoEvento>) =>
    setLineas((prev) => prev.map((l) => (l.id === id ? { ...l, ...cambios } : l)));

  const guardar = async () => {
    // Una linea sin concepto ni beneficiario y en cero es una fila que se
    // agrego y no se lleno: se descarta en vez de guardar basura.
    const limpias = lineas.filter(
      (l) => l.concepto.trim() || l.beneficiario.trim() || Number(l.valor) > 0
    );
    const sinValor = limpias.filter((l) => !(Number(l.valor) > 0));
    if (sinValor.length > 0) {
      toast({
        title: "Falta el valor",
        description: `Hay ${sinValor.length} línea${sinValor.length === 1 ? "" : "s"} sin valor. Escríbelo o borra la línea.`,
        variant: "destructive",
      });
      return;
    }

    setGuardando(true);
    try {
      await onGuardar(limpias.map((l) => ({ ...l, valor: Number(l.valor) || 0 })));
      onOpenChange(false);
    } catch (error: unknown) {
      toast({
        title: "No se pudo guardar",
        description: error instanceof Error ? error.message : "Intenta de nuevo",
        variant: "destructive",
      });
    } finally {
      setGuardando(false);
    }
  };

  if (!proyecto) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl sm:max-h-[88vh] flex flex-col">
        <DialogHeader className="pr-10">
          <DialogTitle className="flex items-center gap-2 text-left text-base">
            <Receipt className="h-4 w-4 shrink-0" />
            Costos · {proyecto.evento || "Sin nombre"}
          </DialogTitle>
          <DialogDescription className="text-left">
            Lo que costó el evento: proveedores, personal, transporte y demás.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 space-y-2 overflow-y-auto">
          {lineas.length === 0 && (
            <div className="rounded-lg border border-dashed border-border p-6 text-center">
              <p className="text-sm font-medium">Todavía no hay costos cargados</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {soloLectura
                  ? "Nadie ha registrado costos para este evento."
                  : "Agrega una línea por cada proveedor o persona que se pagó."}
              </p>
            </div>
          )}

          {lineas.map((linea) => (
            <div key={linea.id} className="rounded-lg border border-border/70 p-3">
              <div className="grid gap-2 sm:grid-cols-[150px_1fr_auto]">
                <div>
                  <Label className="text-[10px] uppercase text-muted-foreground">Tipo</Label>
                  <Select
                    value={linea.tipo}
                    onValueChange={(v) =>
                      cambiar(linea.id, { tipo: v as TipoCosto, beneficiarioId: undefined })
                    }
                    disabled={soloLectura}
                  >
                    <SelectTrigger className="mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {TIPOS.map((t) => (
                        <SelectItem key={t.valor} value={t.valor}>
                          {t.nombre}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="min-w-0">
                  <Label className="text-[10px] uppercase text-muted-foreground">
                    {linea.tipo === "personal" ? "Persona" : "Proveedor o a quién se le pagó"}
                  </Label>
                  <div className="mt-1">
                    {soloLectura ? (
                      <Input value={linea.beneficiario} readOnly />
                    ) : linea.tipo === "personal" ? (
                      <EmpleadoAutocomplete
                        value={linea.beneficiario}
                        onChange={(nombre, empleadoId) =>
                          cambiar(linea.id, { beneficiario: nombre, beneficiarioId: empleadoId })
                        }
                        placeholder="Buscar empleado..."
                      />
                    ) : linea.tipo === "proveedor" || linea.tipo === "transporte" ? (
                      <ProveedorAutocomplete
                        value={linea.beneficiario}
                        onChange={(nombre, proveedorId) =>
                          cambiar(linea.id, { beneficiario: nombre, beneficiarioId: proveedorId })
                        }
                      />
                    ) : (
                      <Input
                        value={linea.beneficiario}
                        onChange={(e) => cambiar(linea.id, { beneficiario: e.target.value })}
                        placeholder="Nombre"
                      />
                    )}
                  </div>
                </div>

                {!soloLectura && (
                  <div className="flex items-end">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                      onClick={() => setLineas((prev) => prev.filter((l) => l.id !== linea.id))}
                      title="Borrar esta línea"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </div>

              <div className="mt-2 grid gap-2 sm:grid-cols-[1fr_170px]">
                <div>
                  <Label className="text-[10px] uppercase text-muted-foreground">Concepto</Label>
                  <Input
                    className="mt-1"
                    value={linea.concepto}
                    readOnly={soloLectura}
                    onChange={(e) => cambiar(linea.id, { concepto: e.target.value })}
                    placeholder="Ej: operario de montaje, alquiler de pantalla"
                  />
                </div>
                <div>
                  <Label className="text-[10px] uppercase text-muted-foreground">Valor</Label>
                  <Input
                    className="mt-1 tabular-nums"
                    type="number"
                    inputMode="numeric"
                    min={0}
                    step={1000}
                    value={linea.valor || ""}
                    readOnly={soloLectura}
                    onChange={(e) => cambiar(linea.id, { valor: Number(e.target.value) || 0 })}
                    placeholder="0"
                  />
                  {Number(linea.valor) > 0 && (
                    <p className="mt-1 text-[11px] text-muted-foreground tabular-nums">
                      {pesos.format(Number(linea.valor))}
                    </p>
                  )}
                </div>
              </div>
            </div>
          ))}

          {!soloLectura && (
            <Button
              variant="outline"
              className="h-11 w-full"
              onClick={() => setLineas((prev) => [...prev, lineaNueva()])}
            >
              <Plus className="mr-2 h-4 w-4" />
              Agregar línea
            </Button>
          )}
        </div>

        {/* El resumen se queda fijo: es lo que se va a mirar mientras se
            escriben las lineas. */}
        <div className="shrink-0 space-y-2 rounded-lg border border-border p-3">
          {porTipo.length > 0 && (
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
              {porTipo.map(([tipo, valor]) => (
                <span key={tipo} className="tabular-nums">
                  {nombreDeTipo(tipo)}: {pesos.format(valor)}
                </span>
              ))}
            </div>
          )}
          <div className="grid grid-cols-3 gap-2 text-sm">
            <div>
              <div className="text-[10px] uppercase text-muted-foreground">Costos</div>
              <div className="font-semibold tabular-nums">{pesos.format(total)}</div>
            </div>
            <div>
              <div className="text-[10px] uppercase text-muted-foreground">Ingreso total</div>
              <div className="font-semibold tabular-nums">{pesos.format(ingreso)}</div>
            </div>
            <div>
              <div className="text-[10px] uppercase text-muted-foreground">Utilidad</div>
              <div
                className={`font-semibold tabular-nums ${
                  utilidad < 0 ? "text-destructive" : "text-emerald-500"
                }`}
              >
                {pesos.format(utilidad)}
                {margen !== null && (
                  <span className="ml-1 text-[11px] font-normal text-muted-foreground">
                    ({margen.toFixed(0)}%)
                  </span>
                )}
              </div>
            </div>
          </div>
          <p className="text-[11px] text-muted-foreground">
            Utilidad = Ingreso total − costos. Es control interno del evento, no
            contabilidad: no descuenta impuestos ni dice si ya se cobró.
          </p>
        </div>

        <DialogFooter className="shrink-0 gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)} className="h-11 w-full sm:h-10 sm:w-auto">
            {soloLectura ? "Cerrar" : "Cancelar"}
          </Button>
          {!soloLectura && (
            <Button onClick={guardar} disabled={guardando} className="h-11 w-full sm:h-10 sm:w-auto">
              {guardando ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Guardar costos
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default CostosEventoDialog;
