import { useEffect, useMemo, useState } from "react";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Loader2, ArrowDownLeft, ArrowUpRight } from "lucide-react";
import { Activo, NuevoMovimiento } from "@/hooks/useBodega";
import { Project } from "@/types";
import { cn } from "@/lib/utils";

interface Props {
  activo: Activo | null;
  tipo: "salida" | "entrada";
  proyectos: Project[];
  abierto: boolean;
  onCerrar: () => void;
  onGuardar: (m: NuevoMovimiento) => Promise<boolean>;
}

/**
 * Sacar equipo de bodega o devolverlo.
 *
 * La cantidad viene con el maximo puesto: para una salida, lo que hay libre;
 * para una entrada, lo que esta afuera. Escribir de mas no se bloquea en
 * silencio, se avisa, porque un numero que no cabe casi siempre significa que
 * algo no volvio de un evento anterior y eso hay que mirarlo, no esconderlo.
 */
export function MovimientoDialog({ activo, tipo, proyectos, abierto, onCerrar, onGuardar }: Props) {
  const esSalida = tipo === "salida";
  const tope = activo ? (esSalida ? activo.disponible : activo.en_evento) : 0;

  const [cantidad, setCantidad] = useState(1);
  const [proyectoId, setProyectoId] = useState<string>("");
  const [notas, setNotas] = useState("");
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    if (abierto) {
      setCantidad(Math.min(1, tope) || 1);
      setProyectoId("");
      setNotas("");
    }
  }, [abierto, tope]);

  // Solo eventos vivos, del mas reciente al mas viejo: un equipo sale para
  // algo que esta por pasar, no para un evento de hace ocho meses.
  const eventos = useMemo(
    () =>
      proyectos
        .filter((p) => !p.isDeleted && p.evento)
        .sort((a, b) => (b.fechaEjecucionInicio || "").localeCompare(a.fechaEjecucionInicio || ""))
        .slice(0, 120),
    [proyectos]
  );

  if (!activo) return null;

  const excede = cantidad > tope;
  const evento = eventos.find((e) => e.id === proyectoId);

  const guardar = async () => {
    setGuardando(true);
    const ok = await onGuardar({
      activo_id: activo.id,
      tipo,
      cantidad: Math.max(1, Math.round(cantidad)),
      project_id: proyectoId || null,
      evento_nombre: evento ? `${evento.evento}${evento.cliente ? ' · ' + evento.cliente : ''}` : null,
      notas: notas.trim() || null,
    });
    setGuardando(false);
    if (ok) onCerrar();
  };

  return (
    <Dialog open={abierto} onOpenChange={(v) => !v && onCerrar()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {esSalida ? <ArrowUpRight className="h-4 w-4" /> : <ArrowDownLeft className="h-4 w-4" />}
            {esSalida ? "Sacar de bodega" : "Devolver a bodega"}
          </DialogTitle>
          <DialogDescription className="text-left">
            <span className="font-medium text-foreground">{activo.elemento}</span>
            <span className="block text-xs">
              {activo.codigo} · {activo.cantidad_total} en total · {activo.disponible} libre(s) ·{" "}
              {activo.en_evento} afuera
            </span>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div>
            <Label htmlFor="cant">Cantidad</Label>
            <Input
              id="cant"
              type="number"
              min={1}
              value={cantidad}
              onChange={(e) => setCantidad(Number(e.target.value))}
              className={cn(excede && "border-destructive")}
            />
            {excede && (
              <p className="mt-1 text-xs text-destructive">
                {esSalida
                  ? `Solo hay ${tope} disponible(s). Si crees que debería haber más, revisa qué no ha vuelto.`
                  : `Solo hay ${tope} afuera. No se puede devolver más de lo que salió.`}
              </p>
            )}
          </div>

          {esSalida && (
            <div>
              <Label>¿Para qué evento?</Label>
              <Select value={proyectoId} onValueChange={setProyectoId}>
                <SelectTrigger>
                  <SelectValue placeholder="Sin evento (préstamo, taller, reparación)" />
                </SelectTrigger>
                <SelectContent>
                  {eventos.map((e) => (
                    <SelectItem key={e.id} value={e.id}>
                      {e.evento}
                      {e.fechaEjecucionInicio ? ` · ${e.fechaEjecucionInicio}` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="mt-1 text-[11px] text-muted-foreground">
                Ligarlo a un evento es lo que después deja ver qué equipo está en la calle y dónde.
              </p>
            </div>
          )}

          <div>
            <Label htmlFor="notas">Observaciones</Label>
            <Textarea
              id="notas"
              rows={2}
              value={notas}
              onChange={(e) => setNotas(e.target.value)}
              placeholder={esSalida ? "Estado en que sale, quién lo recibe…" : "Cómo volvió: completo, con novedad…"}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onCerrar}>Cancelar</Button>
          <Button onClick={guardar} disabled={guardando || excede || cantidad < 1}>
            {guardando && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {esSalida ? "Registrar salida" : "Registrar entrada"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
