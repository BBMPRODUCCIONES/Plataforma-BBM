import { useEffect, useRef, useState } from "react";
import { Loader2, Sparkles, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useProveedores } from "@/contexts/ProveedoresContext";
import { toast } from "@/hooks/use-toast";
import { Attachment, CostoEvento } from "@/types";

/**
 * Lee con IA los soportes de costos (factura, recibo, cuenta de cobro) y
 * propone la linea de costo: proveedor, concepto y valor.
 *
 * Lee solo al subir un archivo nuevo, o cuando alguien da "Leer" en uno ya
 * subido. Nunca agrega la linea sola: muestra lo que encontro y la persona
 * decide si la agrega (sin IVA o con IVA). Si el proveedor no esta en
 * "Creacion de Proveedores", se crea al agregar la linea.
 */

interface Lectura {
  proveedor: string | null;
  nitProveedor: string | null;
  numeroDocumento: string | null;
  fecha: string | null;
  concepto: string | null;
  subtotal: number | null;
  iva: number | null;
  total: number | null;
  confianza: string | null;
}

interface Estado {
  leyendo?: boolean;
  lectura?: Lectura;
  error?: string;
  usado?: boolean;
}

const pesos = new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 });

const legible = (a: Attachment) =>
  (a.type || "").startsWith("image/") || a.type === "application/pdf" || /\.(pdf|jpe?g|png|webp)$/i.test(a.name);

const tipoDe = (a: Attachment) => {
  if (a.type && a.type !== "application/octet-stream") return a.type;
  if (/\.pdf$/i.test(a.name)) return "application/pdf";
  if (/\.png$/i.test(a.name)) return "image/png";
  if (/\.webp$/i.test(a.name)) return "image/webp";
  return "image/jpeg";
};

/** "Luxury Eventos S.A.S." -> "luxury eventos" para comparar nombres. */
const clave = (t: string) =>
  t
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\b(s\.?\s?a\.?\s?s\.?|sas|ltda|s\.?a\.?|e\.?u\.?)\b/g, " ")
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const num = (v: unknown) => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? Math.round(n) : null;
};

const blobADataUrl = (b: Blob) =>
  new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = reject;
    r.readAsDataURL(b);
  });

interface Props {
  adjuntos: Attachment[];
  onAgregarLinea: (linea: CostoEvento) => void;
}

export function LectorSoportesCostos({ adjuntos, onAgregarLinea }: Props) {
  const { proveedores, addProveedor } = useProveedores();
  const [estados, setEstados] = useState<Record<string, Estado>>({});
  const [agregando, setAgregando] = useState<string | null>(null);
  // Los que ya estaban al abrir no se leen solos (cuesta y puede que ya esten
  // cargados); los que se suban de aqui en adelante, si.
  const conocidos = useRef<Set<string> | null>(null);

  const leer = async (a: Attachment) => {
    if (!a.filePath) return;
    setEstados((e) => ({ ...e, [a.id]: { leyendo: true } }));
    try {
      const { data: blob, error: errDescarga } = await supabase.storage
        .from(a.bucket || "project-attachments")
        .download(a.filePath);
      if (errDescarga || !blob) throw new Error("no se pudo abrir el archivo");
      const fileContent = await blobADataUrl(blob);
      const { data, error } = await supabase.functions.invoke("process-purchase-order", {
        body: { fileContent, fileType: tipoDe(a), fileName: a.name, tipoDocumento: "soporte_costo" },
      });
      if (error || !data?.success) throw new Error(data?.error || error?.message || "sin respuesta");
      const d = (data.data || {}) as Record<string, unknown>;
      const lectura: Lectura = {
        proveedor: d.proveedor ? String(d.proveedor).trim() : null,
        nitProveedor: d.nitProveedor ? String(d.nitProveedor).trim() : null,
        numeroDocumento: d.numeroDocumento ? String(d.numeroDocumento).trim() : null,
        fecha: d.fecha ? String(d.fecha).slice(0, 10) : null,
        concepto: d.concepto ? String(d.concepto).trim() : null,
        subtotal: num(d.subtotal),
        iva: num(d.iva),
        total: num(d.total),
        confianza: d.confianza ? String(d.confianza) : null,
      };
      if (!lectura.subtotal && !lectura.total) throw new Error("no encontró valores en el documento");
      setEstados((e) => ({ ...e, [a.id]: { lectura } }));
    } catch (err) {
      setEstados((e) => ({
        ...e,
        [a.id]: { error: err instanceof Error ? err.message : "no se pudo leer" },
      }));
    }
  };

  useEffect(() => {
    const ids = new Set(adjuntos.map((a) => a.id));
    if (conocidos.current === null) {
      conocidos.current = ids;
      return;
    }
    const nuevos = adjuntos.filter((a) => !conocidos.current!.has(a.id) && legible(a) && a.filePath);
    conocidos.current = ids;
    nuevos.forEach((a) => void leer(a));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [adjuntos]);

  const agregar = async (a: Attachment, l: Lectura, valor: number) => {
    setAgregando(a.id);
    try {
      let beneficiario = "";
      let beneficiarioId: string | undefined;
      if (l.proveedor) {
        const k = clave(l.proveedor);
        const existente = proveedores.find((p) => {
          const kp = clave(p.nombre || "");
          return kp && k && (kp === k || kp.includes(k) || k.includes(kp));
        });
        if (existente) {
          beneficiario = existente.nombre;
          beneficiarioId = existente.id;
        } else {
          const creado = await addProveedor({
            nombre: l.proveedor,
            categoria: "",
            telefono: "",
            correo: "",
            tipoProductoServicio: "",
            notas: l.nitProveedor ? `NIT/CC: ${l.nitProveedor}` : "",
            cotizacionesAnteriores: [],
          });
          if (creado) {
            beneficiario = creado.nombre;
            beneficiarioId = creado.id;
            toast({ title: "Proveedor creado", description: `${creado.nombre} quedó en Creación de Proveedores.` });
          }
        }
      }
      const partes = [l.concepto || "Según soporte", l.numeroDocumento ? `Doc. ${l.numeroDocumento}` : ""].filter(Boolean);
      onAgregarLinea({
        id: `costo-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        tipo: "proveedor",
        concepto: partes.join(" · "),
        beneficiario,
        beneficiarioId,
        valor,
        creadoEn: new Date().toISOString(),
      });
      setEstados((e) => ({ ...e, [a.id]: { ...e[a.id], usado: true } }));
      toast({ title: "Línea agregada", description: "Revísala y da \"Guardar costos\"." });
    } catch (err) {
      toast({
        title: "No se pudo agregar la línea",
        description: err instanceof Error ? err.message : "Intenta de nuevo.",
        variant: "destructive",
      });
    } finally {
      setAgregando(null);
    }
  };

  const leibles = adjuntos.filter((a) => legible(a) && a.filePath);
  if (leibles.length === 0) return null;

  return (
    <div className="space-y-2">
      {leibles.map((a) => {
        const e = estados[a.id] || {};
        const l = e.lectura;
        return (
          <div key={a.id} className="rounded-md border border-dashed border-border p-2 text-xs">
            <div className="flex items-center justify-between gap-2">
              <span className="truncate text-muted-foreground">{a.name}</span>
              {!e.leyendo && !l && (
                <Button type="button" variant="outline" size="sm" className="h-7 shrink-0 px-2 text-xs" onClick={() => void leer(a)}>
                  <Sparkles className="mr-1 h-3.5 w-3.5" /> Leer costo
                </Button>
              )}
              {e.leyendo && (
                <span className="flex shrink-0 items-center gap-1 text-muted-foreground">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" /> Leyendo…
                </span>
              )}
            </div>
            {e.error && <p className="mt-1 text-destructive">No se pudo leer: {e.error}. Cárgalo a mano.</p>}
            {l && !e.usado && (
              <div className="mt-2 space-y-1.5">
                <div className="grid grid-cols-2 gap-x-3 gap-y-0.5">
                  <span className="text-muted-foreground">Proveedor</span>
                  <span className="font-medium">{l.proveedor || "—"}{l.nitProveedor ? ` · ${l.nitProveedor}` : ""}</span>
                  <span className="text-muted-foreground">Concepto</span>
                  <span>{l.concepto || "—"}</span>
                  <span className="text-muted-foreground">Documento</span>
                  <span>{[l.numeroDocumento, l.fecha].filter(Boolean).join(" · ") || "—"}</span>
                  <span className="text-muted-foreground">Sin IVA / IVA / Total</span>
                  <span className="tabular-nums">
                    {l.subtotal ? pesos.format(l.subtotal) : "—"} / {l.iva ? pesos.format(l.iva) : "$ 0"} / {l.total ? pesos.format(l.total) : "—"}
                  </span>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Leído por IA (confianza {l.confianza || "?"}). Revisa antes de guardar.
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {l.subtotal != null && (
                    <Button type="button" size="sm" className="h-7 px-2 text-xs" disabled={agregando === a.id}
                      onClick={() => void agregar(a, l, l.subtotal!)}>
                      {agregando === a.id ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <Plus className="mr-1 h-3.5 w-3.5" />}
                      Agregar sin IVA ({pesos.format(l.subtotal)})
                    </Button>
                  )}
                  {l.total != null && l.total !== l.subtotal && (
                    <Button type="button" size="sm" variant="outline" className="h-7 px-2 text-xs" disabled={agregando === a.id}
                      onClick={() => void agregar(a, l, l.total!)}>
                      <Plus className="mr-1 h-3.5 w-3.5" /> Agregar total ({pesos.format(l.total)})
                    </Button>
                  )}
                  <Button type="button" size="sm" variant="ghost" className="h-7 px-2 text-xs"
                    onClick={() => setEstados((s) => ({ ...s, [a.id]: { ...s[a.id], usado: true } }))}>
                    <X className="mr-1 h-3.5 w-3.5" /> Descartar
                  </Button>
                </div>
              </div>
            )}
            {l && e.usado && <p className="mt-1 text-muted-foreground">Listo.</p>}
          </div>
        );
      })}
    </div>
  );
}
