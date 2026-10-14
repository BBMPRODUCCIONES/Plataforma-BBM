import { useCallback, useEffect, useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Check, Image as ImagenIcon, Loader2, Search } from "lucide-react";
import { Activo, Novedad, TipoNovedad } from "@/hooks/useBodega";
import { TIPOS } from "./NovedadDialog";
import { cn } from "@/lib/utils";

interface Props {
  novedades: Novedad[];
  activos: Activo[];
  firmarFotos: (rutas: string[]) => Promise<string[]>;
  onResolver: (id: string, nota: string) => Promise<boolean>;
}

const COLOR: Record<TipoNovedad, string> = {
  // El daño y la baja pesan distinto: la baja es plata que ya no esta.
  dano: "border-amber-500/40 text-amber-700 dark:text-amber-500",
  observacion: "border-sky-500/40 text-sky-700 dark:text-sky-400",
  mantenimiento: "border-violet-500/40 text-violet-700 dark:text-violet-400",
  baja: "border-destructive/40 text-destructive",
};

const ETIQUETA: Record<TipoNovedad, string> = {
  dano: "Daño", observacion: "Observación", mantenimiento: "Mantenimiento", baja: "Pérdida o baja",
};

/** dd mmm aaaa sin depender de la zona del navegador: la fecha ya viene suelta. */
function fechaLegible(iso: string) {
  const [a, m, d] = iso.split("-").map(Number);
  const meses = ["ene","feb","mar","abr","may","jun","jul","ago","sep","oct","nov","dic"];
  return `${d} ${meses[(m || 1) - 1]} ${a}`;
}

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

export function PanelNovedades({ novedades, activos, firmarFotos, onResolver }: Props) {
  const [tipo, setTipo] = useState<string>("todos");
  const [estado, setEstado] = useState<string>("abiertas");
  const [busca, setBusca] = useState("");
  const [cerrando, setCerrando] = useState<string | null>(null);
  const [nota, setNota] = useState("");

  const porId = useMemo(() => new Map(activos.map((a) => [a.id, a])), [activos]);

  const lista = useMemo(() => {
    const t = busca.trim().toLowerCase();
    return novedades.filter((n) => {
      if (estado === "abiertas" && n.resuelta) return false;
      if (estado === "cerradas" && !n.resuelta) return false;
      if (tipo !== "todos" && n.tipo !== tipo) return false;
      if (!t) return true;
      const a = porId.get(n.activo_id);
      return (
        n.descripcion.toLowerCase().includes(t) ||
        (a?.elemento || "").toLowerCase().includes(t) ||
        (a?.codigo || "").toLowerCase().includes(t) ||
        (n.evento_nombre || "").toLowerCase().includes(t)
      );
    });
  }, [busca, estado, novedades, porId, tipo]);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <div className="relative min-w-[180px] flex-1">
          <Search className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input className="pl-7" placeholder="Buscar por equipo, código, evento o texto…"
                 value={busca} onChange={(e) => setBusca(e.target.value)} />
        </div>
        <Select value={tipo} onValueChange={setTipo}>
          <SelectTrigger className="w-[170px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos los tipos</SelectItem>
            {TIPOS.map((t) => <SelectItem key={t.valor} value={t.valor}>{t.etiqueta}</SelectItem>)}
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
      </div>

      {lista.length === 0 ? (
        <Card><CardContent className="p-8 text-center text-sm text-muted-foreground">
          {estado === "abiertas"
            ? "No hay novedades abiertas. Todo el equipo está sano, o nadie ha reportado nada."
            : "No hay novedades que coincidan."}
        </CardContent></Card>
      ) : (
        <div className="space-y-2">
          {lista.map((n) => {
            const a = porId.get(n.activo_id);
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

                  <p className="text-sm">
                    <span className="font-mono text-xs text-muted-foreground">{a?.codigo || "—"}</span>{" "}
                    <span className="font-medium">{a?.elemento || "Equipo dado de baja"}</span>
                    {n.unidades ? <span className="text-muted-foreground"> · {n.unidades} unidad(es)</span> : null}
                  </p>

                  <p className="whitespace-pre-wrap text-sm text-muted-foreground">{n.descripcion}</p>

                  {n.evento_nombre && (
                    <p className="text-xs text-muted-foreground">Pasó en: {n.evento_nombre}</p>
                  )}

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
                      <Input autoFocus value={nota} placeholder="¿Cómo se resolvió?"
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
                      <Check className="mr-1.5 h-3.5 w-3.5" />Marcar resuelta
                    </Button>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <p className="text-[11px] text-muted-foreground">
        Una novedad se cierra, no se borra: queda con su nota de cierre. Es lo que sustenta
        un reclamo o una baja meses después.
      </p>
    </div>
  );
}
