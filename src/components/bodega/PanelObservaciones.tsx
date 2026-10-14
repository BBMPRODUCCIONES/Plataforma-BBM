import { useCallback, useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Check, Image as ImagenIcon, Loader2, Plus, Search } from "lucide-react";
import { Novedad } from "@/hooks/useBodega";
import { COLOR, ETIQUETA, TIPOS_GENERAL, fechaLegible } from "./tiposNovedad";
import { cn } from "@/lib/utils";

interface Props {
  observaciones: Novedad[];
  puedeVerValores: boolean;
  firmarFotos: (rutas: string[]) => Promise<string[]>;
  onResolver: (id: string, nota: string) => Promise<boolean>;
  onNueva: () => void;
}

const pesos = (v: number) =>
  new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(v || 0);

function Fotos({ rutas, firmar }: { rutas: string[]; firmar: (r: string[]) => Promise<string[]> }) {
  const [urls, setUrls] = useState<string[] | null>(null);
  const [cargando, setCargando] = useState(false);

  const ver = useCallback(async () => {
    setCargando(true);
    setUrls(await firmar(rutas));
    setCargando(false);
  }, [firmar, rutas]);

  if (!rutas.length) return null;
  if (!urls) {
    return (
      <Button variant="outline" size="sm" className="h-7 text-xs" onClick={ver} disabled={cargando}>
        {cargando ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <ImagenIcon className="mr-1.5 h-3.5 w-3.5" />}
        Ver {rutas.length} foto{rutas.length > 1 ? "s" : ""}
      </Button>
    );
  }
  return (
    <div className="flex flex-wrap gap-2">
      {urls.map((u, i) => (
        <a key={i} href={u} target="_blank" rel="noreferrer">
          <img src={u} alt={`Foto ${i + 1}`} className="h-20 w-20 rounded border object-cover" />
        </a>
      ))}
    </div>
  );
}

/**
 * Las observaciones de la bodega que no cuelgan de ningun equipo.
 *
 * Es una lista de pendientes, no un historial: por eso abre en "abiertas" y
 * por eso lo primero que se ve es el boton de agregar. Una observacion se
 * cierra con nota ("comprado", "ya se mando al taller"), no se borra.
 */
export function PanelObservaciones({
  observaciones, puedeVerValores, firmarFotos, onResolver, onNueva,
}: Props) {
  const [tipo, setTipo] = useState<string>("todos");
  const [estado, setEstado] = useState<string>("abiertas");
  const [busca, setBusca] = useState("");
  const [cerrando, setCerrando] = useState<string | null>(null);
  const [nota, setNota] = useState("");

  const lista = useMemo(() => {
    const t = busca.trim().toLowerCase();
    return observaciones.filter((n) => {
      if (estado === "abiertas" && n.resuelta) return false;
      if (estado === "cerradas" && !n.resuelta) return false;
      if (tipo !== "todos" && n.tipo !== tipo) return false;
      return !t || n.descripcion.toLowerCase().includes(t);
    });
  }, [busca, estado, observaciones, tipo]);

  // Lo que costaria lo que esta a la vista, no todo el historico: si el filtro
  // dice "por comprar abiertas", el total tiene que ser el de esa lista.
  const totalVisible = useMemo(
    () => lista.reduce((t, n) => t + Number(n.valor_estimado ?? 0) * (n.unidades ?? 1), 0),
    [lista]
  );

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <div className="relative min-w-[180px] flex-1">
          <Search className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input className="pl-7" placeholder="Buscar en las observaciones…"
                 value={busca} onChange={(e) => setBusca(e.target.value)} />
        </div>
        <Select value={tipo} onValueChange={setTipo}>
          <SelectTrigger className="w-[190px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos los tipos</SelectItem>
            {TIPOS_GENERAL.map((t) => <SelectItem key={t.valor} value={t.valor}>{t.etiqueta}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={estado} onValueChange={setEstado}>
          <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="abiertas">Abiertas</SelectItem>
            <SelectItem value="cerradas">Cerradas</SelectItem>
            <SelectItem value="todas">Todas</SelectItem>
          </SelectContent>
        </Select>
        <Button size="sm" onClick={onNueva}>
          <Plus className="mr-1.5 h-4 w-4" />Nueva
        </Button>
      </div>

      {puedeVerValores && totalVisible > 0 && (
        <p className="text-xs text-muted-foreground">
          Estimado de lo que estás viendo:{" "}
          <span className="font-semibold tabular-nums text-foreground">{pesos(totalVisible)}</span>
          {" "}· son valores puestos a mano, no cotizaciones.
        </p>
      )}

      {lista.length === 0 ? (
        <Card><CardContent className="p-8 text-center text-sm text-muted-foreground">
          {estado === "abiertas"
            ? "No hay observaciones abiertas. Cuando falte algo en bodega, anótalo acá con «Nueva»."
            : "No hay observaciones que coincidan."}
        </CardContent></Card>
      ) : (
        <div className="space-y-2">
          {lista.map((n) => {
            const sub = Number(n.valor_estimado ?? 0) * (n.unidades ?? 1);
            return (
              <Card key={n.id} className={cn(n.resuelta && "opacity-70")}>
                <CardContent className="space-y-2 p-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline" className={cn("text-xs", COLOR[n.tipo])}>
                      {ETIQUETA[n.tipo]}
                    </Badge>
                    <span className="text-xs tabular-nums text-muted-foreground">{fechaLegible(n.fecha)}</span>
                    {n.resuelta && <Badge variant="outline" className="text-xs">Cerrada</Badge>}
                    <span className="ml-auto text-xs text-muted-foreground">{n.reportada_por_nombre}</span>
                  </div>

                  <p className="whitespace-pre-wrap text-sm">{n.descripcion}</p>

                  <p className="text-xs text-muted-foreground">
                    {n.unidades ? `${n.unidades} unidad(es)` : "Cantidad sin definir"}
                    {puedeVerValores && n.valor_estimado !== null && (
                      <> · {pesos(Number(n.valor_estimado))} c/u
                        {n.unidades && n.unidades > 1 ? <> · total {pesos(sub)}</> : null}
                      </>
                    )}
                  </p>

                  <Fotos rutas={n.fotos} firmar={firmarFotos} />

                  {n.resuelta ? (
                    n.resuelta_nota && (
                      <p className="rounded border-l-2 border-emerald-500/50 bg-emerald-500/5 px-2 py-1 text-xs">
                        <span className="font-medium">Cierre</span>
                        {n.resuelta_por_nombre ? ` · ${n.resuelta_por_nombre}` : ""}: {n.resuelta_nota}
                      </p>
                    )
                  ) : cerrando === n.id ? (
                    <div className="flex gap-2">
                      <Input autoFocus value={nota}
                             placeholder={n.tipo === "compra" ? "¿Dónde se compró, a qué precio?" : "¿Cómo se resolvió?"}
                             onChange={(e) => setNota(e.target.value)}
                             onKeyDown={(e) => {
                               if (e.key === "Enter") { void onResolver(n.id, nota); setCerrando(null); setNota(""); }
                             }} />
                      <Button size="sm" onClick={() => { void onResolver(n.id, nota); setCerrando(null); setNota(""); }}>
                        Cerrar
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => { setCerrando(null); setNota(""); }}>
                        Cancelar
                      </Button>
                    </div>
                  ) : (
                    <Button size="sm" variant="outline" className="h-7 text-xs"
                            onClick={() => { setCerrando(n.id); setNota(""); }}>
                      <Check className="mr-1.5 h-3.5 w-3.5" />
                      {n.tipo === "compra" ? "Marcar comprado" : "Marcar resuelta"}
                    </Button>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <p className="text-[11px] text-muted-foreground">
        Marcar algo como comprado o resuelto no lo mete al inventario. Cuando el
        equipo llegue a bodega hay que crearlo en Inventario con su código.
      </p>
    </div>
  );
}
