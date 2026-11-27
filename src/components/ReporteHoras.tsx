import { useCallback, useEffect, useMemo, useState } from "react";
import * as XLSX from "xlsx-js-style";
import { ChevronDown, ChevronRight, Download, Image as ImageIcon, Loader2, MapPin, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  fechaCortaDia,
  formatoHoras,
  horaBogota,
  Jornada,
  mapaDe,
  Marcacion,
  mesActualBogota,
  rangoUtc,
  resumenPorPersona,
} from "@/lib/marcaciones";

/**
 * Reporte de horas trabajadas a partir de las fotos de llegada y salida.
 * El administrador ve a todos; cada quien ve solo lo suyo (lo filtra la base).
 */
export function ReporteHoras({ titulo = "Horas trabajadas", recargar = 0 }: { titulo?: string; recargar?: number }) {
  const mes = mesActualBogota();
  const [desde, setDesde] = useState(mes.desde);
  const [hasta, setHasta] = useState(mes.hasta);
  const [marcas, setMarcas] = useState<Marcacion[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [abiertos, setAbiertos] = useState<Set<string>>(new Set());
  const [foto, setFoto] = useState<{ url: string; titulo: string } | null>(null);

  const cargar = useCallback(async () => {
    if (!desde || !hasta || desde > hasta) return;
    setCargando(true);
    setError(null);
    const r = rangoUtc(desde, hasta);
    const { data, error: err } = await supabase
      .from("marcaciones" as never)
      .select("*")
      .gte("marcada_en", r.desde)
      .lte("marcada_en", r.hasta)
      .order("marcada_en", { ascending: true })
      .limit(5000);
    if (err) setError(err.message);
    setMarcas((data as unknown as Marcacion[]) || []);
    setCargando(false);
  }, [desde, hasta]);

  useEffect(() => {
    void cargar();
  }, [cargar, recargar]);

  const resumen = useMemo(() => resumenPorPersona(marcas), [marcas]);
  const totalHoras = resumen.reduce((a, r) => a + r.horas, 0);

  const verFoto = async (m: Marcacion) => {
    const { data, error: err } = await supabase.storage.from("marcaciones").createSignedUrl(m.foto_path, 3600);
    if (err || !data?.signedUrl) {
      toast.error("No se pudo abrir la foto", { description: err?.message });
      return;
    }
    setFoto({
      url: data.signedUrl,
      titulo: `${m.tipo === "entrada" ? "Llegada" : "Salida"} · ${m.nombre} · ${fechaCortaDia(
        new Intl.DateTimeFormat("en-CA", { timeZone: "America/Bogota" }).format(new Date(m.marcada_en))
      )} ${horaBogota(m.marcada_en)}`,
    });
  };

  const descargar = () => {
    const resumenFilas = [
      ["Persona", "Correo", "Días trabajados", "Horas", "Horas (decimal)", "Jornadas incompletas"],
      ...resumen.map((r) => [r.nombre, r.correo, r.dias, formatoHoras(r.horas), Math.round(r.horas * 100) / 100, r.incompletas]),
      ["TOTAL", "", "", formatoHoras(totalHoras), Math.round(totalHoras * 100) / 100, ""],
    ];
    const jornadas = [
      ["Persona", "Día", "Llegada", "Ubicación llegada", "Salida", "Ubicación salida", "Horas", "Horas (decimal)", "Observación"],
      ...resumen.flatMap((r) =>
        [...r.jornadas]
          .sort((a, b) => a.dia.localeCompare(b.dia))
          .map((j) => [
            r.nombre,
            j.dia,
            j.entrada ? horaBogota(j.entrada.marcada_en) : "",
            j.entrada ? j.entrada.direccion || mapaDe(j.entrada) || "" : "",
            j.salida ? horaBogota(j.salida.marcada_en) : "",
            j.salida ? j.salida.direccion || mapaDe(j.salida) || "" : "",
            formatoHoras(j.horas),
            j.horas != null ? Math.round(j.horas * 100) / 100 : "",
            j.horas == null ? (j.entrada ? "Sin salida marcada" : "Sin llegada marcada") : "",
          ])
      ),
    ];
    const libro = XLSX.utils.book_new();
    const h1 = XLSX.utils.aoa_to_sheet(resumenFilas);
    h1["!cols"] = [{ wch: 28 }, { wch: 34 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 20 }];
    const h2 = XLSX.utils.aoa_to_sheet(jornadas);
    h2["!cols"] = [{ wch: 28 }, { wch: 12 }, { wch: 10 }, { wch: 45 }, { wch: 10 }, { wch: 45 }, { wch: 12 }, { wch: 14 }, { wch: 20 }];
    XLSX.utils.book_append_sheet(libro, h1, "Resumen");
    XLSX.utils.book_append_sheet(libro, h2, "Jornadas");
    XLSX.writeFile(libro, `Horas trabajadas ${desde} a ${hasta}.xlsx`);
  };

  const alternar = (id: string) =>
    setAbiertos((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  const Marca = ({ m }: { m: Marcacion | null }) => {
    if (!m) return <span className="text-xs font-medium text-amber-600">Sin marcar</span>;
    const mapa = mapaDe(m);
    return (
      <span className="flex min-w-0 flex-col">
        <span className="flex items-center gap-1.5">
          <span className="font-medium tabular-nums">{horaBogota(m.marcada_en)}</span>
          <button type="button" onClick={() => void verFoto(m)} className="text-primary hover:opacity-70" title="Ver foto">
            <ImageIcon className="h-3.5 w-3.5" />
          </button>
          {mapa && (
            <a href={mapa} target="_blank" rel="noopener noreferrer" className="text-primary hover:opacity-70" title="Ver en el mapa">
              <MapPin className="h-3.5 w-3.5" />
            </a>
          )}
        </span>
        {m.direccion && <span className="truncate text-[11px] text-muted-foreground" title={m.direccion}>{m.direccion}</span>}
      </span>
    );
  };

  const FilaJornada = ({ j }: { j: Jornada }) => (
    <div className="grid grid-cols-[5.5rem_minmax(0,1fr)_minmax(0,1fr)_5.5rem] items-start gap-2 px-3 py-2 text-sm">
      <span className="text-xs text-muted-foreground">{fechaCortaDia(j.dia)}</span>
      <Marca m={j.entrada} />
      <Marca m={j.salida} />
      <span className={cn("text-right tabular-nums", j.horas == null && "text-xs text-amber-600")}>
        {j.horas == null ? "Incompleta" : formatoHoras(j.horas)}
      </span>
    </div>
  );

  return (
    <div className="panel-card space-y-3 rounded-xl border border-border bg-card p-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="mr-auto">
          <h2 className="text-base font-semibold">{titulo}</h2>
          <p className="text-sm text-muted-foreground">
            Cada llegada se empareja con la salida siguiente. Una jornada sin salida (o sin llegada) no suma horas.
          </p>
        </div>
        <div>
          <Label className="text-xs">Desde</Label>
          <Input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} className="h-9 w-[9.5rem]" />
        </div>
        <div>
          <Label className="text-xs">Hasta</Label>
          <Input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} className="h-9 w-[9.5rem]" />
        </div>
        <Button variant="outline" size="sm" className="h-9" onClick={() => void cargar()} disabled={cargando}>
          <RefreshCw className={cn("h-4 w-4", cargando && "animate-spin")} />
        </Button>
        <Button size="sm" className="h-9" onClick={descargar} disabled={resumen.length === 0}>
          <Download className="mr-2 h-4 w-4" /> Excel
        </Button>
      </div>

      {error && <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">No se pudieron leer las marcas: {error}</p>}

      {cargando ? (
        <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Cargando…
        </div>
      ) : resumen.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
          No hay llegadas ni salidas marcadas en estas fechas.
        </p>
      ) : (
        <div className="divide-y divide-border overflow-hidden rounded-lg border border-border">
          {resumen.map((r) => {
            const abierto = abiertos.has(r.userId) || resumen.length === 1;
            return (
              <div key={r.userId}>
                <button
                  type="button"
                  onClick={() => alternar(r.userId)}
                  className="flex w-full items-center gap-3 px-3 py-2.5 text-left hover:bg-muted/40"
                >
                  {abierto ? <ChevronDown className="h-4 w-4 shrink-0" /> : <ChevronRight className="h-4 w-4 shrink-0" />}
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{r.nombre}</span>
                    <span className="block text-xs text-muted-foreground">
                      {r.dias} día{r.dias === 1 ? "" : "s"}
                      {r.incompletas > 0 && <span className="text-amber-600"> · {r.incompletas} incompleta{r.incompletas === 1 ? "" : "s"}</span>}
                    </span>
                  </span>
                  <span className="shrink-0 text-base font-semibold tabular-nums">{formatoHoras(r.horas)}</span>
                </button>
                {abierto && (
                  <div className="divide-y divide-border/60 bg-muted/20">
                    <div className="grid grid-cols-[5.5rem_minmax(0,1fr)_minmax(0,1fr)_5.5rem] gap-2 px-3 py-1.5 text-[10px] uppercase tracking-wide text-muted-foreground">
                      <span>Día</span>
                      <span>Llegada</span>
                      <span>Salida</span>
                      <span className="text-right">Horas</span>
                    </div>
                    {r.jornadas.map((j) => (
                      <FilaJornada key={j.clave} j={j} />
                    ))}
                  </div>
                )}
              </div>
            );
          })}
          {resumen.length > 1 && (
            <div className="flex items-center justify-between bg-muted/40 px-3 py-2.5 text-sm font-semibold">
              <span>Total ({resumen.length} personas)</span>
              <span className="tabular-nums">{formatoHoras(totalHoras)}</span>
            </div>
          )}
        </div>
      )}

      <Dialog open={Boolean(foto)} onOpenChange={(a) => !a && setFoto(null)}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader className="pr-10">
            <DialogTitle className="text-left text-sm">{foto?.titulo}</DialogTitle>
          </DialogHeader>
          {foto && <img src={foto.url} alt={foto.titulo} className="mx-auto max-h-[75vh] rounded-lg" />}
        </DialogContent>
      </Dialog>
    </div>
  );
}
