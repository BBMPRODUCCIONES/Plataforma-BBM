import { useCallback, useEffect, useMemo, useState } from "react";
import { Download, FileSpreadsheet, Loader2, Lock } from "lucide-react";
import { endOfMonth, endOfYear, format, startOfMonth, startOfYear, subMonths } from "date-fns";
import Layout from "@/components/Layout";
import { PanelHeader } from "@/components/PanelHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { puedeExportarCostos } from "@/lib/permisosCostos";
import { lineaCambioTrasVerificar, lineaVerificada, TIPO_SIN_TERCEROS } from "@/lib/costosEvento";
import { CostoEvento } from "@/types";

/**
 * Exportar costos a Excel.
 *
 * Solo para las seis personas de lib/permisosCostos (EXPORTADORES). La base
 * tambien lo comprueba: la funcion exportar_costos rechaza a cualquier otro.
 *
 * Libro con tres hojas:
 *  - Resumen por evento: venta sin IVA, costos, utilidad, margen, cierre.
 *  - Detalle de costos: una fila por linea de costo, con su verificacion.
 *  - Por proveedor: cuanto se le pago a cada quien en el periodo.
 *
 * Utilidad = venta sin IVA − costos. Margen = utilidad / venta sin IVA.
 * Venta sin IVA = ingreso bruto; si no hay bruto, el ingreso total (y se marca).
 * Es control interno, no contabilidad: no dice si ya se cobro.
 */
interface FilaEvento {
  id: string;
  evento: string;
  cliente: string;
  centro_costos: string | null;
  productor: string | null;
  estado: string;
  fecha_ejecucion_inicio: string;
  fecha_ejecucion_fin: string | null;
  ingreso_bruto: number | null;
  ingreso_total: number | null;
  num_factura: string | null;
  estado_facturacion: string | null;
  factura_fecha: string | null;
  factura_subtotal: number | null;
  costos: CostoEvento[];
  costos_cerrados_por: string | null;
  costos_cerrados_en: string | null;
}

const TIPOS: Record<string, string> = {
  personal: "Personal",
  proveedor: "Proveedor",
  transporte: "Transporte",
  alquiler: "Alquiler de equipos",
  produccion: "Producción",
  alimentacion: "Alimentación",
  otro: "Otro",
};

/** Orden fijo de las columnas por tipo en el resumen. */
const ORDEN_TIPOS = Object.keys(TIPOS) as (keyof typeof TIPOS)[];

/** Nombre de archivo seguro para Windows. */
const limpioArchivo = (t: string) => t.replace(/[\\/:*?"<>|]+/g, " ").replace(/\s+/g, " ").trim().slice(0, 60);

function totales(lista: FilaEvento[]) {
  const ventaBase = lista.reduce((s, e) => s + venta(e).base, 0);
  const costos = lista.reduce((s, e) => s + totalCostos(e), 0);
  return {
    eventos: lista.length,
    venta: ventaBase,
    costos,
    utilidad: ventaBase - costos,
    margen: ventaBase > 0 ? ((ventaBase - costos) / ventaBase) * 100 : null,
    cerrados: lista.filter((e) => e.costos_cerrados_en).length,
    lineas: lista.reduce((s, e) => s + lineas(e).length, 0),
  };
}

const pesos = (n: number) =>
  new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(n);
const iso = (d: Date) => format(d, "yyyy-MM-dd");
const fechaCO = (v?: string | null) => (v ? v.slice(0, 10) : "");
const fechaHoraCO = (v?: string | null) =>
  v ? new Date(v).toLocaleString("es-CO", { timeZone: "America/Bogota", dateStyle: "short", timeStyle: "short" }) : "";

function venta(e: FilaEvento) {
  const bruto = Number(e.ingreso_bruto) || 0;
  const total = Number(e.ingreso_total) || 0;
  return bruto > 0 ? { base: bruto, sinDiscriminar: false } : { base: total, sinDiscriminar: total > 0 };
}
const lineas = (e: FilaEvento) => (e.costos || []).filter((c) => c.tipo !== (TIPO_SIN_TERCEROS as CostoEvento["tipo"]));
const sinTerceros = (e: FilaEvento) => (e.costos || []).some((c) => c.tipo === (TIPO_SIN_TERCEROS as CostoEvento["tipo"]));
const totalCostos = (e: FilaEvento) => lineas(e).reduce((s, c) => s + (Number(c.valor) || 0), 0);
const estadoCostos = (e: FilaEvento) =>
  e.costos_cerrados_en ? "Cerrados" : (e.costos || []).length === 0 ? "Sin costos" : "Abiertos";

export default function ExportarCostos() {
  const { user } = useAuth();
  const permitido = puedeExportarCostos(user?.email);
  const hoy = new Date();
  const [desde, setDesde] = useState(iso(startOfMonth(hoy)));
  const [hasta, setHasta] = useState(iso(endOfMonth(hoy)));
  const [filtro, setFiltro] = useState<"todos" | "cerrados" | "abiertos" | "con_costos">("todos");
  const [filas, setFilas] = useState<FilaEvento[]>([]);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [descargando, setDescargando] = useState(false);
  const [descargandoUno, setDescargandoUno] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    if (!permitido || !desde || !hasta) return;
    setCargando(true);
    setError(null);
    const { data, error } = await supabase.rpc("exportar_costos" as never, { p_desde: desde, p_hasta: hasta } as never);
    if (error) {
      setError(error.message);
      setFilas([]);
    } else {
      setFilas(((data as unknown[]) || []) as FilaEvento[]);
    }
    setCargando(false);
  }, [permitido, desde, hasta]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  const visibles = useMemo(
    () =>
      filas.filter((e) => {
        if (filtro === "cerrados") return Boolean(e.costos_cerrados_en);
        if (filtro === "abiertos") return !e.costos_cerrados_en;
        if (filtro === "con_costos") return (e.costos || []).length > 0;
        return true;
      }),
    [filas, filtro]
  );

  const tot = useMemo(() => totales(visibles), [visibles]);

  const rango = (d: Date, h: Date) => {
    setDesde(iso(d));
    setHasta(iso(h));
  };

  // lista: los eventos a exportar (todos los del filtro, o uno solo desde su
  // fila). archivo: nombre del Excel.
  const descargar = async (lista: FilaEvento[] = visibles, archivo = `Costos BBM ${desde} a ${hasta}.xlsx`) => {
    const tot = totales(lista);
    if (lista.length === 1) setDescargandoUno(lista[0].id); else setDescargando(true);
    try {
      const XLSX = await import("xlsx-js-style");
      const encabezado = {
        font: { bold: true, color: { rgb: "FFFFFF" } },
        fill: { fgColor: { rgb: "000000" } },
        alignment: { vertical: "center", wrapText: true },
      };
      const moneda = "#,##0";
      const subtotalEstilo = { font: { bold: true }, fill: { fgColor: { rgb: "EEF2FF" } } };
      const hoja = (filasHoja: (string | number | null)[][], anchos: number[], columnasMoneda: number[], filasNegrita: number[] = []) => {
        const ws = XLSX.utils.aoa_to_sheet(filasHoja);
        const rango = XLSX.utils.decode_range(ws["!ref"] || "A1");
        for (const r of filasNegrita) {
          for (let c = rango.s.c; c <= rango.e.c; c++) {
            const ref = XLSX.utils.encode_cell({ r, c });
            if (!ws[ref]) ws[ref] = { t: "s", v: "" };
            ws[ref].s = subtotalEstilo;
          }
        }
        for (let c = rango.s.c; c <= rango.e.c; c++) {
          const ref = XLSX.utils.encode_cell({ r: 0, c });
          if (ws[ref]) ws[ref].s = encabezado;
        }
        for (let r = 1; r <= rango.e.r; r++) {
          for (const c of columnasMoneda) {
            const ref = XLSX.utils.encode_cell({ r, c });
            if (ws[ref] && typeof ws[ref].v === "number") ws[ref].z = moneda;
          }
        }
        ws["!cols"] = anchos.map((w) => ({ wch: w }));
        ws["!freeze"] = { xSplit: 0, ySplit: 1 };
        return ws;
      };

      // Hoja 1: resumen por evento
      const resumen: (string | number | null)[][] = [[
        "Evento", "Cliente", "Centro de costos", "Productor", "Ejecución inicio", "Ejecución fin",
        "Venta sin IVA", "Venta sin IVA discriminado", "Costos",
        ...ORDEN_TIPOS.map((t) => `Costos · ${TIPOS[t]}`),
        "Utilidad", "Margen %",
        "Líneas de costo", "Líneas verificadas", "Estado de costos", "Cerrados por", "Cerrados el",
        "Sin costos de terceros", "# Factura", "Subtotal factura", "Fecha factura", "Facturación",
      ]];
      for (const e of lista) {
        const v = venta(e);
        const c = totalCostos(e);
        const ls = lineas(e);
        resumen.push([
          e.evento, e.cliente, e.centro_costos || "", e.productor || "",
          fechaCO(e.fecha_ejecucion_inicio), fechaCO(e.fecha_ejecucion_fin),
          v.base, v.sinDiscriminar ? "No (es el total)" : "Sí", c,
          ...ORDEN_TIPOS.map((t) => {
            const suma = ls.filter((l) => l.tipo === t).reduce((a, l) => a + (Number(l.valor) || 0), 0);
            return suma || null;
          }),
          v.base - c,
          v.base > 0 ? Math.round(((v.base - c) / v.base) * 1000) / 10 : null,
          ls.length, (e.costos || []).filter(lineaVerificada).length, estadoCostos(e),
          e.costos_cerrados_por || "", fechaHoraCO(e.costos_cerrados_en),
          sinTerceros(e) ? "Sí" : "", e.num_factura || "", e.factura_subtotal != null ? Number(e.factura_subtotal) : null,
          fechaCO(e.factura_fecha), e.estado_facturacion || "",
        ]);
      }
      resumen.push([]);
      resumen.push(["TOTAL", "", "", "", "", "", tot.venta, "", tot.costos,
        ...ORDEN_TIPOS.map((t) => lista.reduce((a, e) => a + lineas(e).filter((l) => l.tipo === t).reduce((b, l) => b + (Number(l.valor) || 0), 0), 0)),
        tot.utilidad,
        tot.margen != null ? Math.round(tot.margen * 10) / 10 : null, tot.lineas, null, `${tot.cerrados} cerrados`]);

      // Hoja 2: detalle de costos
      const detalle: (string | number | null)[][] = [[
        "Evento", "Cliente", "Centro de costos", "Ejecución inicio", "Tipo", "Concepto",
        "Proveedor / persona", "Valor", "Nota", "Cargado por", "Cargado el",
        "Verificación", "Verificado por", "Verificado el", "Costos del evento",
      ]];
      // Una fila por cada costo y, al final de cada evento, su subtotal: asi se
      // ve de que esta hecho el total y no solo la suma.
      const filasSubtotal: number[] = [];
      for (const e of lista) {
        const ls = lineas(e);
        if (ls.length === 0) continue;
        for (const l of ls) {
          detalle.push([
            e.evento, e.cliente, e.centro_costos || "", fechaCO(e.fecha_ejecucion_inicio),
            TIPOS[l.tipo] || l.tipo, l.concepto || "", l.beneficiario || "", Number(l.valor) || 0,
            l.nota || "", l.creadoPorEmail || "", fechaHoraCO(l.creadoEn),
            lineaVerificada(l) ? "Verificado" : lineaCambioTrasVerificar(l) ? "Cambió después de verificar" : "Sin verificar",
            l.verificacion?.por || "", fechaHoraCO(l.verificacion?.en),
            estadoCostos(e),
          ]);
        }
        filasSubtotal.push(detalle.length);
        detalle.push([
          `Subtotal · ${e.evento}`, "", "", "", `${ls.length} línea(s)`, "", "",
          ls.reduce((a, l) => a + (Number(l.valor) || 0), 0), "", "", "", "", "", "", "",
        ]);
      }
      filasSubtotal.push(detalle.length);
      detalle.push([lista.length === 1 ? "TOTAL DEL EVENTO" : "TOTAL DEL PERIODO", "", "", "", `${tot.lineas} línea(s)`, "", "", tot.costos, "", "", "", "", "", "", ""]);

      // Hoja 3: por proveedor / persona
      const porQuien = new Map<string, { nombre: string; tipo: string; valor: number; lineas: number; eventos: Set<string> }>();
      for (const e of lista) {
        for (const l of lineas(e)) {
          // Sin nombre no se amontona todo en una fila: se usa el concepto.
          const quien = (l.beneficiario || "").trim() || `(sin nombre) ${(l.concepto || "").trim() || TIPOS[l.tipo] || l.tipo}`.trim();
          const k = quien.toLowerCase();
          const a = porQuien.get(k) || { nombre: quien, tipo: TIPOS[l.tipo] || l.tipo, valor: 0, lineas: 0, eventos: new Set<string>() };
          a.valor += Number(l.valor) || 0;
          a.lineas += 1;
          a.eventos.add(e.id);
          porQuien.set(k, a);
        }
      }
      const proveedores: (string | number | null)[][] = [["Proveedor / persona", "Tipo", "Total pagado", "Líneas", "Eventos"]];
      [...porQuien.values()]
        .sort((a, b) => b.valor - a.valor)
        .forEach((a) => proveedores.push([a.nombre, a.tipo, a.valor, a.lineas, a.eventos.size]));

      const libro = XLSX.utils.book_new();
      const nTipos = ORDEN_TIPOS.length;
      XLSX.utils.book_append_sheet(libro, hoja(detalle, [34, 24, 14, 12, 18, 30, 26, 14, 24, 26, 16, 22, 26, 16, 12], [7], filasSubtotal), "Detalle de costos");
      XLSX.utils.book_append_sheet(libro, hoja(resumen,
        [34, 24, 14, 22, 12, 12, 15, 12, 15, ...Array(nTipos).fill(14), 15, 9, 9, 10, 12, 26, 16, 10, 12, 15, 12, 14],
        [6, 8, ...Array.from({ length: nTipos }, (_, i) => 9 + i), 9 + nTipos, 18 + nTipos]), "Resumen por evento");
      XLSX.utils.book_append_sheet(libro, hoja(proveedores, [32, 18, 16, 8, 8], [2]), "Por proveedor");
      XLSX.writeFile(libro, archivo);
      toast({ title: "Excel descargado", description: `${tot.eventos} eventos · ${tot.lineas} líneas de costo` });
    } catch (e) {
      toast({ title: "No se pudo generar el Excel", description: e instanceof Error ? e.message : "", variant: "destructive" });
    } finally {
      setDescargando(false);
      setDescargandoUno(null);
    }
  };

  if (!permitido) {
    return (
      <Layout>
        <div className="mx-auto max-w-md py-16 text-center">
          <Lock className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
          <p className="font-semibold">No tienes acceso a exportar costos</p>
          <p className="mt-1 text-sm text-muted-foreground">Pídele acceso a Bayron si lo necesitas.</p>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-4">
        <PanelHeader title="Exportar costos" description="Descarga en Excel los costos de los eventos, por fecha de ejecución" />

        <Card>
          <CardContent className="flex flex-wrap items-end gap-3 p-4">
            <div className="space-y-1">
              <Label className="text-xs">Ejecución desde</Label>
              <Input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} className="h-9 w-40" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Hasta</Label>
              <Input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} className="h-9 w-40" />
            </div>
            <div className="flex flex-wrap gap-1">
              <Button size="sm" variant="outline" className="h-9 text-xs" onClick={() => rango(startOfMonth(hoy), endOfMonth(hoy))}>Este mes</Button>
              <Button size="sm" variant="outline" className="h-9 text-xs" onClick={() => { const m = subMonths(hoy, 1); rango(startOfMonth(m), endOfMonth(m)); }}>Mes anterior</Button>
              <Button size="sm" variant="outline" className="h-9 text-xs" onClick={() => rango(startOfYear(hoy), endOfYear(hoy))}>Este año</Button>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Eventos</Label>
              <Select value={filtro} onValueChange={(v) => setFiltro(v as typeof filtro)}>
                <SelectTrigger className="h-9 w-44 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  <SelectItem value="con_costos">Solo con costos</SelectItem>
                  <SelectItem value="cerrados">Costos cerrados</SelectItem>
                  <SelectItem value="abiertos">Costos abiertos</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button className="ml-auto h-9 gap-2" onClick={() => void descargar()} disabled={descargando || cargando || visibles.length === 0}>
              {descargando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
              Descargar Excel
            </Button>
          </CardContent>
        </Card>

        {error ? (
          <p className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">{error}</p>
        ) : cargando ? (
          <div className="flex items-center gap-2 p-6 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Cargando…</div>
        ) : visibles.length === 0 ? (
          <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
            <FileSpreadsheet className="mx-auto mb-2 h-6 w-6" />
            No hay eventos en ese rango.
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
              <Dato k="Eventos" v={`${tot.eventos}`} sub={`${tot.cerrados} con costos cerrados`} />
              <Dato k="Venta sin IVA" v={pesos(tot.venta)} />
              <Dato k="Costos" v={pesos(tot.costos)} sub={`${tot.lineas} líneas`} />
              <Dato k="Utilidad" v={pesos(tot.utilidad)} />
              <Dato k="Margen" v={tot.margen != null ? `${tot.margen.toFixed(1)}%` : "—"} />
            </div>
            <div className="overflow-x-auto rounded-lg border">
              <table className="w-full text-xs">
                <thead className="bg-muted/50 text-left">
                  <tr>
                    {["Ejecución", "Evento", "Cliente", "CC", "Venta sin IVA", "Costos", "Utilidad", "Margen", "Costos", "Descargar"].map((h, i) => (
                      <th key={i} className="whitespace-nowrap px-3 py-2 font-medium">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {visibles.map((e) => {
                    const v = venta(e).base;
                    const c = totalCostos(e);
                    return (
                      <tr key={e.id}>
                        <td className="whitespace-nowrap px-3 py-2 tabular-nums">{fechaCO(e.fecha_ejecucion_inicio)}</td>
                        <td className="max-w-[16rem] truncate px-3 py-2">{e.evento}</td>
                        <td className="max-w-[12rem] truncate px-3 py-2">{e.cliente}</td>
                        <td className="whitespace-nowrap px-3 py-2 font-mono">{e.centro_costos || "—"}</td>
                        <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums">{pesos(v)}</td>
                        <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums">{pesos(c)}</td>
                        <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums">{pesos(v - c)}</td>
                        <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums">{v > 0 ? `${(((v - c) / v) * 100).toFixed(0)}%` : "—"}</td>
                        <td className="whitespace-nowrap px-3 py-2">
                          {e.costos_cerrados_en ? <span className="inline-flex items-center gap-1 text-emerald-500"><Lock className="h-3 w-3" />Cerrados</span> : <span className="text-muted-foreground">{estadoCostos(e)}</span>}
                        </td>
                        <td className="whitespace-nowrap px-2 py-1 text-center">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            title="Descargar los costos de este evento"
                            aria-label={`Descargar costos de ${e.evento}`}
                            disabled={descargandoUno !== null || descargando}
                            onClick={() =>
                              void descargar(
                                [e],
                                `Costos ${limpioArchivo(e.evento)} ${fechaCO(e.fecha_ejecucion_inicio)}.xlsx`
                              )
                            }
                          >
                            {descargandoUno === e.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Utilidad = venta sin IVA − costos. Margen = utilidad ÷ venta sin IVA. Control interno: no indica si el evento ya se cobró.
            </p>
          </>
        )}
      </div>
    </Layout>
  );
}

function Dato({ k, v, sub }: { k: string; v: string; sub?: string }) {
  return (
    <Card>
      <CardContent className="p-3">
        <div className="text-[10px] uppercase text-muted-foreground">{k}</div>
        <div className="text-lg font-bold tabular-nums">{v}</div>
        {sub && <div className="text-[11px] text-muted-foreground">{sub}</div>}
      </CardContent>
    </Card>
  );
}
