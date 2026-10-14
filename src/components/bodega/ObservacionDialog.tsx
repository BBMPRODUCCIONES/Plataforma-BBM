import { useEffect, useState } from "react";
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
import { Loader2, Camera, X, ClipboardList } from "lucide-react";
import { NuevaNovedad, TipoGeneral } from "@/hooks/useBodega";
import { TIPOS_GENERAL, hoyBogota } from "./tiposNovedad";

interface Props {
  abierto: boolean;
  /** Sin permiso de ver cifras, el campo de valor no se dibuja. */
  puedeVerValores: boolean;
  onCerrar: () => void;
  onGuardar: (datos: NuevaNovedad, fotos: File[]) => Promise<boolean>;
}

const pesos = (v: number) =>
  new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(v || 0);

/**
 * Una observacion de bodega que no cuelga de ningun equipo: lo que hay que
 * comprar, lo que hay que mandar a arreglar, una idea de organizacion.
 *
 * Es el mismo formulario de las novedades menos el equipo y el evento, y mas
 * el valor estimado. Va en un archivo aparte en vez de un modo del otro
 * porque los dos formularios se leen distinto: alla se describe algo que ya
 * paso, aca algo que falta por hacer.
 */
export function ObservacionDialog({ abierto, puedeVerValores, onCerrar, onGuardar }: Props) {
  const [tipo, setTipo] = useState<TipoGeneral>("compra");
  const [descripcion, setDescripcion] = useState("");
  const [fecha, setFecha] = useState(hoyBogota());
  const [unidades, setUnidades] = useState<string>("");
  const [valor, setValor] = useState<string>("");
  const [fotos, setFotos] = useState<File[]>([]);
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    if (abierto) {
      setTipo("compra"); setDescripcion(""); setFecha(hoyBogota());
      setUnidades(""); setValor(""); setFotos([]);
    }
  }, [abierto]);

  const pista = TIPOS_GENERAL.find((t) => t.valor === tipo)?.pista;
  const enElFuturo = fecha > hoyBogota();

  const cantidad = unidades ? Math.max(1, Math.round(Number(unidades))) : null;
  const valorNum = valor ? Math.max(0, Number(valor)) : null;
  const total = valorNum !== null ? valorNum * (cantidad ?? 1) : null;

  const guardar = async () => {
    setGuardando(true);
    const ok = await onGuardar(
      {
        activo_id: null,
        tipo,
        descripcion,
        fecha,
        unidades: cantidad,
        valor_estimado: valorNum,
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
            <ClipboardList className="h-4 w-4" />Nueva observación
          </DialogTitle>
          <DialogDescription className="text-left">
            Para lo que no es de un equipo puntual del inventario: lo que hay que
            comprar, lo que hay que mandar a arreglar, cómo organizar la bodega.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div>
            <Label>Tipo</Label>
            <Select value={tipo} onValueChange={(v) => setTipo(v as TipoGeneral)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {TIPOS_GENERAL.map((t) => (
                  <SelectItem key={t.valor} value={t.valor}>{t.etiqueta}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {pista && <p className="mt-1 text-[11px] text-muted-foreground">{pista}</p>}
          </div>

          <div>
            <Label htmlFor="dobs">
              {tipo === "compra" ? "¿Qué hay que comprar?" : "¿De qué se trata?"}
            </Label>
            <Textarea id="dobs" rows={3} value={descripcion}
                      onChange={(e) => setDescripcion(e.target.value)}
                      placeholder={tipo === "compra"
                        ? "Ej: cables XLR de 10 metros, para reponer los que se dañaron."
                        : "Describe la observación como se la contarías a quien la va a atender."} />
          </div>

          <div className={puedeVerValores ? "grid grid-cols-3 gap-3" : "grid grid-cols-2 gap-3"}>
            <div>
              <Label htmlFor="uobs">Cantidad</Label>
              <Input id="uobs" type="number" min={1} placeholder="1"
                     value={unidades} onChange={(e) => setUnidades(e.target.value)} />
            </div>
            {puedeVerValores && (
              <div>
                <Label htmlFor="vobs">Valor c/u</Label>
                <Input id="vobs" type="number" min={0} step={1000} placeholder="0"
                       value={valor} onChange={(e) => setValor(e.target.value)} />
              </div>
            )}
            <div>
              <Label htmlFor="fobs">Fecha</Label>
              <Input id="fobs" type="date" value={fecha} max={hoyBogota()}
                     onChange={(e) => setFecha(e.target.value)} />
            </div>
          </div>

          {enElFuturo && <p className="text-xs text-destructive">Esa fecha todavía no llega.</p>}

          {puedeVerValores && total !== null && total > 0 && (
            <p className="text-xs text-muted-foreground">
              Estimado: <span className="font-medium tabular-nums text-foreground">{pesos(total)}</span>
              {cantidad && cantidad > 1 ? ` (${cantidad} × ${pesos(valorNum ?? 0)})` : ""}
              <span className="block">Es un estimado para dimensionar la lista, no un precio cotizado.</span>
            </p>
          )}

          <div>
            <Label htmlFor="fotoobs" className="flex items-center gap-1.5">
              <Camera className="h-3.5 w-3.5" />Fotos
            </Label>
            <Input id="fotoobs" type="file" accept="image/*" capture="environment" multiple
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
              Hasta 5. Opcional, pero la foto de la referencia que hay que comprar
              ahorra media conversación.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onCerrar}>Cancelar</Button>
          <Button onClick={guardar} disabled={guardando || !descripcion.trim() || enElFuturo}>
            {guardando && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Guardar observación
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
