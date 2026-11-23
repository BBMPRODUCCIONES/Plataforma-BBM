import { useMemo, useState } from "react";
import { endOfMonth, format, startOfMonth, subMonths } from "date-fns";
import { es } from "date-fns/locale";
import { FileArchive, Loader2 } from "lucide-react";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { COLORES_DE_COMERCIAL, colorVisualDeEvento } from "@/lib/coloresProyecto";
import { crearZip, ArchivoZip } from "@/lib/zipSimple";

/**
 * Informe de ventas por comercial: un ZIP con un Excel y los PDF de las
 * facturas de venta del periodo.
 *
 * Lo ven las mismas seis personas que exportan costos; la base lo vuelve a
 * comprobar en informe_ventas().
 *
 * Dos miradas, como en la grafica:
 *  - Vendido: eventos con fecha de EJECUCION en el periodo, sin IVA.
 *  - Facturado: facturas con PDF subido y FECHA DE FACTURA en el periodo.
 * Por eso un mes puede facturar eventos de otro mes. El comercial sale del
 * color de la fila (o del correo de quien subio el evento), igual que en la
 * grafica.
 */

interface FilaInforme {
  id: string;
  evento: string;
  cliente: string;
  productor: string | null;
  estado: string;
  fecha_ejecucion_inicio: string;
  fecha_ejecucion_fin: string | null;
  ingreso_bruto: number | null;
  ingreso_total: number | null;
  color: string | null;
  created_by_email: string | null;
  num_factura: string | null;
  estado_facturacion: string | null;
  factura_fecha: string | null;
  factura_subtotal: number | null;
  factura_iva: number | null;
  factura_total: number | null;
  factura_archivo: { bucket?: string; filePath?: string; name?: string } | null;
}

const SIN_ASIGNAR = "Sin asignar";
const iso = (d: Date) => format(d, "yyyy-MM-dd");
const num = (v: unknown) => Number(v) || 0;

function comercialDe(f: FilaInforme): string {
  const visual = colorVisualDeEvento({ color: f.color, createdByEmail: f.created_by_email });
  const c = COLORES_DE_COMERCIAL.find((x) => x.valor.toLowerCase() === visual?.color.toLowerCase());
  return c?.comercial ?? SIN_ASIGNAR;
}

/** Venta sin IVA, con la misma regla de la grafica (montosDelEvento). */
function venta(f: FilaInforme) {
  const bruto = num(f.ingreso_bruto);
  const total = num(f.ingreso_total);
  if (bruto > 0) {
    const iva = total > bruto ? total - bruto : 0;
    return { base: bruto, iva, total: bruto + iva };
  }
  return { base: total, iva: 0, total };
}

const ESTADO_FACTURACION: Record<string, string> = {
  facturado: "Facturado",
  no_se_factura: "No se factura",
  por_facturar: "Por facturar",
  sin_definir: "Sin definir",
};

/** Nombre de archivo seguro para Windows. */
const limpio = (s: string) =>
  s.replace(/[\\/:*?"<>|]+/g, " ").replace(/\s+/g, " ").trim().slice(0, 80);

function mesesDisponibles() {
  return Array.from({ length: 24 }, (_, i) => {
    const d = startOfMonth(subMonths(new Date(), i));
    return { valor: format(d, "yyyy-MM"), etiqueta: format(d, "MMMM yyyy", { locale: es }) };
  });
}

interface Props {
  open: boolean;
  onOpenChange: (abierto: boolean) => void;
}

export function InformeVentasDialog({ open, onOpenChange }: Props) {
  const meses = useMemo(mesesDisponibles, []);
  const [modo, setModo] = useState<"mes" | "rango">("mes");
  const [mes, setMes] = useState(meses[0].valor);
  const [desde, setDesde] = useState(iso(startOfMonth(new Date())));
  const [hasta, setHasta] = useState(iso(endOfMonth(new Date())));
  const [comercial, setComercial] = useState<string>("todos");
  const [generando, setGenerando] = useState(false);
  const [paso, setPaso] = useState("");

  const periodo = useMemo(() => {
    if (modo === "mes") {
      const d = new Date(`${mes}-01T00:00:00`);
      return { desde: iso(startOfMonth(d)), hasta: iso(endOfMonth(d)) };
    }
    return { desde, hasta };
  }, [modo, mes, desde, hasta]);

  const generar = async () => {
    if (!periodo.desde || !periodo.hasta || periodo.desde > periodo.hasta) {
      toast({ title: "Revisa las fechas", description: "La fecha inicial debe ser anterior a la final.", variant: "destructive" });
      return;
    }
    setGenerando(true);
    try {
      setPaso("Consultando eventos y facturas…");
      const { data, error } = await supabase.rpc("informe_ventas" as never, {
        p_desde: periodo.desde,
        p_hasta: periodo.hasta,
      } as never);
      if (error) throw new Error(error.message);
      const todas = ((data as unknown[]) || []) as FilaInforme[];
      const delComercial = (f: FilaInforme) => comercial === "todos" || comercialDe(f) === comercial;
      const enRango = (fecha: string | null) =>
        Boolean(fecha) && fecha!.slice(0, 10) >= periodo.desde && fecha!.slice(0, 10) <= periodo.hasta;

      const vendidos = todas.filter((f) => enRango(f.fecha_ejecucion_inicio) && delComercial(f));
      const facturas = todas.filter(
        (f) => f.factura_archivo?.filePath && num(f.factura_subtotal) > 0 && enRango(f.factura_fecha) && delComercial(f)
      );

      // PDF de las facturas, con un nombre que se entienda al abrir la carpeta.
      setPaso(`Descargando ${facturas.length} factura(s)…`);
      const archivos: ArchivoZip[] = [];
      const nombrePdf = new Map<string, string>();
      const usados = new Set<string>();
      let fallidas = 0;
      for (const f of facturas) {
        const a = f.factura_archivo!;
        const { data: blob, error: e } = await supabase.storage
          .from(a.bucket || "project-attachments")
          .download(a.filePath!);
        if (e || !blob) {
          fallidas++;
          continue;
        }
        let base = limpio(`${f.factura_fecha ?? ""} ${f.num_factura || "sin numero"} - ${f.cliente}`);
        let nombre = `Facturas/${base}.pdf`;
        for (let i = 2; usados.has(nombre); i++) nombre = `Facturas/${base} (${i}).pdf`;
        usados.add(nombre);
        nombrePdf.set(f.id, nombre.replace("Facturas/", ""));
        archivos.push({ nombre, datos: new Uint8Array(await blob.arrayBuffer()) });
      }

      setPaso("Armando el Excel…");
      const XLSX = await import("xlsx-js-style");
      const encabezado = {
        font: { bold: true, color: { rgb: "FFFFFF" } },
        fill: { fgColor: { rgb: "000000" } },
        alignment: { vertical: "center", wrapText: true },
      };
      const negrita = { font: { bold: true } };
      const hoja = (filas: (string | number | null)[][], anchos: number[], moneda: number[], totalAlFinal = false) => {
        const ws = XLSX.utils.aoa_to_sheet(filas);
        const r = XLSX.utils.decode_range(ws["!ref"] || "A1");
        for (let c = r.s.c; c <= r.e.c; c++) {
          const ref = XLSX.utils.encode_cell({ r: 0, c });
          if (ws[ref]) ws[ref].s = encabezado;
        }
        for (let fila = 1; fila <= r.e.r; fila++) {
          for (let c = r.s.c; c <= r.e.c; c++) {
            const ref = XLSX.utils.encode_cell({ r: fila, c });
            if (!ws[ref]) continue;
            if (moneda.includes(c) && typeof ws[ref].v === "number") ws[ref].z = "#,##0";
            if (totalAlFinal && fila === r.e.r) ws[ref].s = negrita;
          }
        }
        ws["!cols"] = anchos.map((w) => ({ wch: w }));
        return ws;
      };

      const nombres = comercial === "todos"
        ? [...COLORES_DE_COMERCIAL.map((c) => c.comercial as string), SIN_ASIGNAR]
        : [comercial];

      // Hoja 1: resumen por comercial
      const resumen: (string | number | null)[][] = [[
        "Comercial", "Eventos del periodo", "Vendido sin IVA", "IVA de lo vendido", "Vendido con IVA",
        "Facturas", "Facturado subtotal", "IVA facturado", "Total facturado",
        "Eventos ejecutados sin factura", "Valor sin facturar (sin IVA)", "No se factura (sin IVA)",
      ]];
      const hoy = iso(new Date());
      const sumar = (lista: number[]) => lista.reduce((s, v) => s + v, 0);
      const filasResumen = nombres.map((n) => {
        const vs = vendidos.filter((f) => comercialDe(f) === n);
        const fs = facturas.filter((f) => comercialDe(f) === n);
        const sinFactura = vs.filter(
          (f) => (f.fecha_ejecucion_fin || f.fecha_ejecucion_inicio).slice(0, 10) < hoy &&
            !f.factura_archivo?.filePath && f.estado_facturacion !== "no_se_factura" && venta(f).base > 0
        );
        const noFactura = vs.filter((f) => f.estado_facturacion === "no_se_factura");
        return [
          n, vs.length,
          sumar(vs.map((f) => venta(f).base)), sumar(vs.map((f) => venta(f).iva)), sumar(vs.map((f) => venta(f).total)),
          fs.length,
          sumar(fs.map((f) => num(f.factura_subtotal))), sumar(fs.map((f) => num(f.factura_iva))), sumar(fs.map((f) => num(f.factura_total))),
          sinFactura.length, sumar(sinFactura.map((f) => venta(f).base)), sumar(noFactura.map((f) => venta(f).base)),
        ] as (string | number)[];
      }).filter((f) => comercial !== "todos" || f[1] !== 0 || f[5] !== 0);
      resumen.push(...filasResumen);
      if (filasResumen.length > 1) {
        resumen.push(["TOTAL", ...Array.from({ length: 11 }, (_, i) =>
          sumar(filasResumen.map((f) => Number(f[i + 1]) || 0)))]);
      }

      // Hoja 2: ventas (eventos del periodo)
      const ventas: (string | number | null)[][] = [[
        "Fecha ejecución", "Comercial", "Cliente", "Evento", "Productor", "Estado",
        "Venta sin IVA", "IVA", "Venta con IVA", "Facturación", "# Factura", "Fecha factura",
        "Subtotal factura", "Total factura", "PDF en el ZIP",
      ]];
      for (const f of vendidos) {
        const v = venta(f);
        ventas.push([
          f.fecha_ejecucion_inicio?.slice(0, 10) ?? "", comercialDe(f), f.cliente, f.evento, f.productor ?? "",
          f.estado, v.base, v.iva, v.total,
          f.factura_archivo?.filePath ? "Factura subida" : ESTADO_FACTURACION[f.estado_facturacion ?? ""] ?? (f.estado_facturacion || ""),
          f.num_factura || "", f.factura_fecha ?? "",
          f.factura_archivo?.filePath ? num(f.factura_subtotal) : null,
          f.factura_archivo?.filePath ? num(f.factura_total) : null,
          nombrePdf.get(f.id) ?? "",
        ]);
      }
      ventas.push(["TOTAL", "", "", "", "", "", sumar(vendidos.map((f) => venta(f).base)),
        sumar(vendidos.map((f) => venta(f).iva)), sumar(vendidos.map((f) => venta(f).total)), "", "", "", null, null, ""]);

      // Hoja 3: facturas de venta del periodo
      const hojaFacturas: (string | number | null)[][] = [[
        "Fecha factura", "# Factura", "Comercial", "Cliente", "Evento", "Fecha del evento",
        "Subtotal", "IVA", "Total", "Archivo PDF",
      ]];
      for (const f of [...facturas].sort((a, b) => (a.factura_fecha ?? "").localeCompare(b.factura_fecha ?? ""))) {
        hojaFacturas.push([
          f.factura_fecha ?? "", f.num_factura || "", comercialDe(f), f.cliente, f.evento,
          f.fecha_ejecucion_inicio?.slice(0, 10) ?? "",
          num(f.factura_subtotal), num(f.factura_iva), num(f.factura_total),
          nombrePdf.get(f.id) ?? "No se pudo descargar",
        ]);
      }
      hojaFacturas.push(["TOTAL", "", "", "", "", "", sumar(facturas.map((f) => num(f.factura_subtotal))),
        sumar(facturas.map((f) => num(f.factura_iva))), sumar(facturas.map((f) => num(f.factura_total))), ""]);

      const notas: (string | number | null)[][] = [
        ["Cómo leer este informe"],
        [`Periodo: ${periodo.desde} a ${periodo.hasta}. Comercial: ${comercial === "todos" ? "todos" : comercial}.`],
        ["Vendido: eventos con fecha de ejecución en el periodo. Venta sin IVA = ingreso bruto; si no hay bruto, el ingreso total."],
        ["Facturado: facturas con PDF subido al planner y fecha de factura en el periodo. Puede incluir eventos de otros meses."],
        ["El comercial sale del color de la fila en el planner (amarillo Bayron, azul Abraham); si no hay color, del correo de quien subió el evento."],
        ["Es control interno: no dice si la factura ya se cobró."],
        [`Generado el ${format(new Date(), "yyyy-MM-dd HH:mm")}.`],
      ];

      const libro = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(libro, hoja(resumen, [16, 10, 16, 14, 16, 9, 16, 14, 16, 12, 16, 16], [2, 3, 4, 6, 7, 8, 10, 11], filasResumen.length > 1), "Resumen");
      XLSX.utils.book_append_sheet(libro, hoja(ventas, [12, 12, 26, 38, 22, 12, 14, 12, 14, 14, 14, 12, 14, 14, 40], [6, 7, 8, 12, 13], true), "Ventas");
      XLSX.utils.book_append_sheet(libro, hoja(hojaFacturas, [12, 14, 12, 26, 38, 12, 14, 12, 14, 44], [6, 7, 8], true), "Facturas de venta");
      const wsNotas = XLSX.utils.aoa_to_sheet(notas);
      wsNotas["!cols"] = [{ wch: 120 }];
      XLSX.utils.book_append_sheet(libro, wsNotas, "Notas");
      const excel = XLSX.write(libro, { type: "array", bookType: "xlsx" }) as ArrayBuffer;

      const etiqueta = `${comercial === "todos" ? "Todos" : comercial} ${periodo.desde} a ${periodo.hasta}`;
      archivos.unshift({ nombre: `Informe de ventas ${etiqueta}.xlsx`, datos: new Uint8Array(excel) });

      setPaso("Empacando…");
      const zip = crearZip(archivos);
      const url = URL.createObjectURL(zip);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Informe de ventas ${etiqueta}.zip`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 10000);

      toast({
        title: "Informe listo",
        description:
          `${vendidos.length} evento(s) y ${facturas.length - fallidas} factura(s) en PDF.` +
          (fallidas ? ` ${fallidas} PDF no se pudieron descargar (quedan marcados en el Excel).` : ""),
      });
      onOpenChange(false);
    } catch (e) {
      toast({
        title: "No se pudo generar el informe",
        description: e instanceof Error ? e.message : String(e),
        variant: "destructive",
      });
    } finally {
      setGenerando(false);
      setPaso("");
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !generando && onOpenChange(v)}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileArchive className="h-5 w-5" /> Informe de ventas
          </DialogTitle>
          <DialogDescription>
            Un ZIP con un Excel (resumen, ventas y facturas por comercial) y los PDF de las facturas de venta del periodo.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex gap-1.5">
            <Button type="button" size="sm" variant={modo === "mes" ? "default" : "outline"} onClick={() => setModo("mes")}>
              Un mes
            </Button>
            <Button type="button" size="sm" variant={modo === "rango" ? "default" : "outline"} onClick={() => setModo("rango")}>
              Rango de fechas
            </Button>
          </div>

          {modo === "mes" ? (
            <div className="space-y-1.5">
              <Label>Mes</Label>
              <Select value={mes} onValueChange={setMes}>
                <SelectTrigger className="capitalize"><SelectValue /></SelectTrigger>
                <SelectContent className="max-h-[300px]">
                  {meses.map((m) => (
                    <SelectItem key={m.valor} value={m.valor} className="capitalize">{m.etiqueta}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="iv-desde">Desde</Label>
                <Input id="iv-desde" type="date" value={desde} onChange={(e) => setDesde(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="iv-hasta">Hasta</Label>
                <Input id="iv-hasta" type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} />
              </div>
            </div>
          )}

          <div className="space-y-1.5">
            <Label>Comercial</Label>
            <Select value={comercial} onValueChange={setComercial}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                {COLORES_DE_COMERCIAL.map((c) => (
                  <SelectItem key={c.valor} value={c.comercial as string}>{c.comercial}</SelectItem>
                ))}
                <SelectItem value={SIN_ASIGNAR}>{SIN_ASIGNAR}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {generando && (
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> {paso}
            </p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={generando}>Cancelar</Button>
          <Button onClick={generar} disabled={generando}>
            {generando ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileArchive className="mr-2 h-4 w-4" />}
            Descargar informe
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
