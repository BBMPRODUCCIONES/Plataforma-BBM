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
import { Loader2, Camera, X, AlertTriangle } from "lucide-react";
import { Activo, NuevaNovedad, TipoNovedad } from "@/hooks/useBodega";
import { TIPOS_EQUIPO, hoyBogota } from "./tiposNovedad";
import { Project } from "@/types";

interface Props {
  activo: Activo | null;
  proyectos: Project[];
  abierto: boolean;
  onCerrar: () => void;
  onGuardar: (datos: NuevaNovedad, fotos: File[]) => Promise<boolean>;
}

export function NovedadDialog({ activo, proyectos, abierto, onCerrar, onGuardar }: Props) {
  const [tipo, setTipo] = useState<TipoNovedad>("dano");
  const [descripcion, setDescripcion] = useState("");
  const [fecha, setFecha] = useState(hoyBogota());
  const [unidades, setUnidades] = useState<string>("");
  const [proyectoId, setProyectoId] = useState("");
  const [fotos, setFotos] = useState<File[]>([]);
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    if (abierto) {
      setTipo("dano"); setDescripcion(""); setFecha(hoyBogota());
      setUnidades(""); setProyectoId(""); setFotos([]);
    }
  }, [abierto]);

  const eventos = useMemo(
    () => proyectos
      .filter((p) => !p.isDeleted && p.evento)
      .sort((a, b) => (b.fechaEjecucionInicio || "").localeCompare(a.fechaEjecucionInicio || ""))
      .slice(0, 120),
    [proyectos]
  );

  if (!activo) return null;

  const pista = TIPOS_EQUIPO.find((t) => t.valor === tipo)?.pista;
  const evento = eventos.find((e) => e.id === proyectoId);
  const enElFuturo = fecha > hoyBogota();

  const guardar = async () => {
    setGuardando(true);
    const ok = await onGuardar(
      {
        activo_id: activo.id,
        tipo,
        descripcion,
        fecha,
        unidades: unidades ? Math.max(1, Math.round(Number(unidades))) : null,
        project_id: proyectoId || null,
        evento_nombre: evento ? `${evento.evento}${evento.cliente ? " · " + evento.cliente : ""}` : null,
      },
      fotos
    );
    setGuardando(false);
    if (ok) onCerrar();
  };

  return (
    <Dialog open={abierto} onOpenChange={(v) => !v && onCerrar()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4" />Reportar novedad
          </DialogTitle>
          <DialogDescription className="text-left">
            <span className="font-medium text-foreground">{activo.elemento}</span>
            <span className="block text-xs">{activo.codigo} · {activo.cantidad_total} en total</span>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div>
            <Label>Tipo</Label>
            <Select value={tipo} onValueChange={(v) => setTipo(v as TipoNovedad)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {TIPOS_EQUIPO.map((t) => <SelectItem key={t.valor} value={t.valor}>{t.etiqueta}</SelectItem>)}
              </SelectContent>
            </Select>
            {pista && <p className="mt-1 text-[11px] text-muted-foreground">{pista}</p>}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="fnov">¿Cuándo pasó?</Label>
              <Input id="fnov" type="date" value={fecha} max={hoyBogota()}
                     onChange={(e) => setFecha(e.target.value)} />
              <p className="mt-1 text-[11px] text-muted-foreground">
                La fecha del hecho, no la de hoy.
              </p>
            </div>
            <div>
              <Label htmlFor="unov">Unidades</Label>
              <Input id="unov" type="number" min={1} max={activo.cantidad_total}
                     placeholder={`de ${activo.cantidad_total}`}
                     value={unidades} onChange={(e) => setUnidades(e.target.value)} />
              <p className="mt-1 text-[11px] text-muted-foreground">Opcional.</p>
            </div>
          </div>

          {enElFuturo && (
            <p className="text-xs text-destructive">Esa fecha todavía no llega.</p>
          )}

          <div>
            <Label>¿En qué evento pasó?</Label>
            <Select value={proyectoId} onValueChange={setProyectoId}>
              <SelectTrigger><SelectValue placeholder="Sin evento / en bodega" /></SelectTrigger>
              <SelectContent>
                {eventos.map((e) => (
                  <SelectItem key={e.id} value={e.id}>
                    {e.evento}{e.fechaEjecucionInicio ? ` · ${e.fechaEjecucionInicio}` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="dnov">¿Qué pasó?</Label>
            <Textarea id="dnov" rows={3} value={descripcion}
                      onChange={(e) => setDescripcion(e.target.value)}
                      placeholder="Describe la novedad como se la contarías a quien lo va a reparar." />
          </div>

          <div>
            <Label htmlFor="foto" className="flex items-center gap-1.5">
              <Camera className="h-3.5 w-3.5" />Fotos
            </Label>
            {/* capture apunta a la camara trasera del celular: quien recibe el
                camion toma la foto del golpe ahi mismo, sin pasar por galeria. */}
            <Input id="foto" type="file" accept="image/*" capture="environment" multiple
                   onChange={(e) => setFotos(Array.from(e.target.files || []).slice(0, 5))} />
            {fotos.length > 0 && (
              <ul className="mt-1.5 space-y-1">
                {fotos.map((f, i) => (
                  <li key={i} className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                    <span className="min-w-0 truncate">{f.name}</span>
                    <Button type="button" variant="ghost" size="sm" className="h-6 px-1"
                            onClick={() => setFotos(fotos.filter((_, j) => j !== i))}>
                      <X className="h-3 w-3" />
                    </Button>
                  </li>
                ))}
              </ul>
            )}
            <p className="mt-1 text-[11px] text-muted-foreground">
              Hasta 5. Una foto es la diferencia entre «llegó rayado» y poder probarlo.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onCerrar}>Cancelar</Button>
          <Button onClick={guardar} disabled={guardando || !descripcion.trim() || enElFuturo}>
            {guardando && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Registrar novedad
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
