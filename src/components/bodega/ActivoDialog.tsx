import { useEffect, useState } from "react";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Loader2 } from "lucide-react";
import { Activo } from "@/hooks/useBodega";

interface Props {
  activo: Activo | null;      // null = uno nuevo
  categorias: string[];
  abierto: boolean;
  onCerrar: () => void;
  onGuardar: (datos: Partial<Activo>, id?: string) => Promise<boolean>;
  /** Si es false no se muestran las tres cifras de dinero ni se envian. */
  puedeVerValores: boolean;
}

const VACIO: Partial<Activo> = {
  codigo: "", elemento: "", categoria: "", cantidad_total: 1, en_mantenimiento: 0,
  precio_unitario: 0, valor_mercado: 0, depreciacion: 0, ubicacion: "", notas: "",
  revisar: false, activo: true,
};

/** Dar de alta un equipo o corregir uno que ya esta. */
export function ActivoDialog({ activo, categorias, abierto, onCerrar, onGuardar, puedeVerValores }: Props) {
  const [f, setF] = useState<Partial<Activo>>(VACIO);
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    if (abierto) setF(activo ? { ...activo } : { ...VACIO });
  }, [abierto, activo]);

  const set = (k: keyof Activo, v: unknown) => setF((p) => ({ ...p, [k]: v }));

  const faltan = !f.codigo?.trim() || !f.elemento?.trim();

  const guardar = async () => {
    setGuardando(true);
    // Corregir un renglon marcado es justo lo que quita la marca: si alguien
    // se tomo el trabajo de revisarlo, no tiene por que seguir en la lista.
    const datos = { ...f, revisar: false, revisar_motivo: null };
    const ok = await onGuardar(datos, activo?.id);
    setGuardando(false);
    if (ok) onCerrar();
  };

  return (
    <Dialog open={abierto} onOpenChange={(v) => !v && onCerrar()}>
      <DialogContent className="max-h-[88vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{activo ? "Editar equipo" : "Nuevo equipo"}</DialogTitle>
          {activo?.revisar && (
            <DialogDescription className="text-left text-amber-700 dark:text-amber-500">
              Este renglón quedó marcado en la importación: {activo.revisar_motivo}. Al guardar se
              da por revisado.
            </DialogDescription>
          )}
        </DialogHeader>

        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="codigo">Código</Label>
              <Input id="codigo" value={f.codigo || ""} onChange={(e) => set("codigo", e.target.value)} />
            </div>
            <div>
              <Label htmlFor="cat">Categoría</Label>
              <Input
                id="cat" list="cats" value={f.categoria || ""}
                onChange={(e) => set("categoria", e.target.value.toUpperCase())}
                placeholder="AUDIO, PANTALLA…"
              />
              <datalist id="cats">
                {categorias.map((c) => <option key={c} value={c} />)}
              </datalist>
            </div>
          </div>

          <div>
            <Label htmlFor="elem">Elemento</Label>
            <Input id="elem" value={f.elemento || ""} onChange={(e) => set("elemento", e.target.value)} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="cant">Cantidad total</Label>
              <Input id="cant" type="number" min={0} value={f.cantidad_total ?? 0}
                     onChange={(e) => set("cantidad_total", Number(e.target.value))} />
            </div>
            <div>
              <Label htmlFor="mant">En mantenimiento</Label>
              <Input id="mant" type="number" min={0} value={f.en_mantenimiento ?? 0}
                     onChange={(e) => set("en_mantenimiento", Number(e.target.value))} />
              <p className="mt-1 text-[11px] text-muted-foreground">
                Dañado o en reparación: sigue siendo nuestro pero no se puede comprometer.
              </p>
            </div>
          </div>

          {/* Las cifras solo se ven y se editan con permiso. Para los demas
              ni siquiera se dibujan los campos: un campo vacio invita a
              escribir un cero encima del valor real. */}
          {puedeVerValores && (
          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label htmlFor="pu">Precio unitario</Label>
              <Input id="pu" type="number" min={0} value={f.precio_unitario ?? 0}
                     onChange={(e) => set("precio_unitario", Number(e.target.value))} />
            </div>
            <div>
              <Label htmlFor="vm">Valor de mercado</Label>
              <Input id="vm" type="number" min={0} value={f.valor_mercado ?? 0}
                     onChange={(e) => set("valor_mercado", Number(e.target.value))} />
            </div>
            <div>
              <Label htmlFor="dep">Depreciación</Label>
              <Input id="dep" type="number" min={0} value={f.depreciacion ?? 0}
                     onChange={(e) => set("depreciacion", Number(e.target.value))} />
            </div>
          </div>
          )}

          <div>
            <Label htmlFor="ubi">Ubicación en bodega</Label>
            <Input id="ubi" value={f.ubicacion || ""} onChange={(e) => set("ubicacion", e.target.value)}
                   placeholder="Estante, caja, rack…" />
          </div>

          <div>
            <Label htmlFor="not">Observaciones</Label>
            <Textarea id="not" rows={2} value={f.notas || ""} onChange={(e) => set("notas", e.target.value)} />
          </div>

          {activo && (
            <div className="flex items-center justify-between rounded-lg border border-border p-3">
              <div>
                <p className="text-sm font-medium">En el inventario</p>
                <p className="text-[11px] text-muted-foreground">
                  Apágalo para dar de baja. No se borra: su historial de movimientos se conserva.
                </p>
              </div>
              <Switch checked={f.activo !== false} onCheckedChange={(v) => set("activo", v)} />
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onCerrar}>Cancelar</Button>
          <Button onClick={guardar} disabled={guardando || faltan}>
            {guardando && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Guardar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
