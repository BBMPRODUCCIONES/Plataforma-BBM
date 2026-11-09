import { useRef, useState } from "react";
import { AlertTriangle, ExternalLink, FileCheck2, Loader2, Receipt, Trash2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Attachment, FacturaEvento as Factura, Project } from "@/types";
import { cn } from "@/lib/utils";

/**
 * Celda "# Factura" de las tablas.
 *
 * El numero de factura ya no se escribe a mano: hay que SUBIR la factura
 * (PDF o foto). Claude la lee y propone numero, fecha, subtotal, IVA y total;
 * la persona revisa y confirma. Solo los eventos con factura subida cuentan en
 * "ventas reales", con el subtotal y en la fecha de la factura. Lo cotizado
 * sigue siendo la venta estimada.
 */
const BUCKET = "project-attachments";

const pesos = (n?: number | null) =>
  n == null || isNaN(n)
    ? "—"
    : new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(n);

const aNumero = (v: string) => {
  const limpio = v.replace(/[^\d,.-]/g, "").replace(/\./g, "").replace(",", ".");
  const n = Number(limpio);
  return limpio === "" || isNaN(n) ? null : n;
};

const leerComoDataUrl = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = reject;
    r.readAsDataURL(file);
  });

interface Props {
  proyecto: Project;
  soloLectura?: boolean;
  onGuardar: (cambios: Partial<Project>) => Promise<void>;
}

export function FacturaCelda({ proyecto, soloLectura = false, onGuardar }: Props) {
  const [abierto, setAbierto] = useState(false);
  const f = proyecto.factura;
  const conPdf = Boolean(f?.archivo);
  const num = proyecto.numFactura?.trim();

  if (soloLectura && !num && !conPdf) {
    return <span className="text-xs text-muted-foreground">Sin factura</span>;
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setAbierto(true)}
        title={
          conPdf
            ? `Factura ${num} · ${pesos(f?.subtotal)} antes de IVA · ${f?.fecha ?? ""}`
            : num
              ? "Tiene número pero no la factura: súbela para que cuente como venta real"
              : "Subir la factura"
        }
        className={cn(
          "inline-flex max-w-full items-center gap-1 rounded px-1.5 py-0.5 font-mono text-xs transition-colors",
          conPdf && "text-emerald-500 hover:bg-emerald-500/10",
          !conPdf && num && "text-amber-500 hover:bg-amber-500/10",
          !conPdf && !num && "text-muted-foreground hover:bg-muted hover:text-foreground"
        )}
      >
        {conPdf ? (
          <FileCheck2 className="h-3.5 w-3.5 shrink-0" />
        ) : num ? (
          <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
        ) : (
          <Upload className="h-3.5 w-3.5 shrink-0" />
        )}
        <span className="truncate">{num || (soloLectura ? "Sin factura" : "Subir")}</span>
      </button>
      {abierto && (
        <FacturaDialog
          proyecto={proyecto}
          soloLectura={soloLectura}
          onGuardar={onGuardar}
          onClose={() => setAbierto(false)}
        />
      )}
    </>
  );
}

function FacturaDialog({
  proyecto,
  soloLectura,
  onGuardar,
  onClose,
}: Props & { onClose: () => void }) {
  const { user } = useAuth();
  const actual = proyecto.factura;
  const [editando, setEditando] = useState(!actual?.archivo && !soloLectura);
  const [archivo, setArchivo] = useState<Attachment | null>(null);
  const [leyendo, setLeyendo] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);
  const [numero, setNumero] = useState(proyecto.numFactura || "");
  const [fecha, setFecha] = useState("");
  const [subtotal, setSubtotal] = useState("");
  const [iva, setIva] = useState("");
  const [total, setTotal] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const verPdf = async (a?: Attachment | null) => {
    if (!a?.filePath) return;
    const { data, error } = await supabase.storage.from(a.bucket || BUCKET).createSignedUrl(a.filePath, 600);
    if (error || !data?.signedUrl) {
      toast({ title: "No se pudo abrir la factura", description: error?.message, variant: "destructive" });
      return;
    }
    window.open(data.signedUrl, "_blank", "noopener");
  };

  const alElegir = async (file: File) => {
    if (file.size > 10 * 1024 * 1024) {
      toast({ title: "Archivo muy grande", description: "Máximo 10 MB.", variant: "destructive" });
      return;
    }
    setLeyendo(true);
    setAviso(null);
    try {
      const ext = file.name.split(".").pop() || "pdf";
      const filePath = `${proyecto.id}/facturas/${crypto.randomUUID()}.${ext}`;
      const { error: errSubida } = await supabase.storage.from(BUCKET).upload(filePath, file);
      if (errSubida) throw new Error("No se pudo subir el archivo: " + errSubida.message);
      setArchivo({
        id: crypto.randomUUID(),
        name: file.name,
        url: "",
        type: file.type,
        size: file.size,
        uploadedAt: new Date().toISOString(),
        filePath,
        bucket: BUCKET,
      });

      // Claude lee la factura. Si falla, el archivo ya quedo subido y los
      // datos se escriben a mano: la lectura ayuda, no es obligatoria.
      try {
        const fileContent = await leerComoDataUrl(file);
        const { data, error } = await supabase.functions.invoke("process-purchase-order", {
          body: { fileContent, fileType: file.type || "application/pdf", fileName: file.name, tipoDocumento: "factura" },
        });
        if (error || !data?.success) throw new Error(data?.error || error?.message || "sin respuesta");
        const d = data.data || {};
        if (d.numeroFactura) setNumero(String(d.numeroFactura));
        if (d.fechaFactura) setFecha(String(d.fechaFactura).slice(0, 10));
        if (d.subtotal != null) setSubtotal(String(d.subtotal));
        if (d.iva != null) setIva(String(d.iva));
        if (d.total != null) setTotal(String(d.total));
        const cliente = (d.cliente || "").toString().trim();
        setAviso(
          `Leída por IA (confianza ${d.confianza || "?"}). Revisa los valores antes de guardar.` +
            (cliente ? ` Cliente en la factura: ${cliente}.` : "")
        );
      } catch (e) {
        setAviso(
          "No se pudo leer la factura automáticamente (" +
            (e instanceof Error ? e.message : "error") +
            "). Escribe los datos a mano."
        );
      }
    } catch (e) {
      toast({ title: "Error", description: e instanceof Error ? e.message : "No se pudo subir", variant: "destructive" });
    } finally {
      setLeyendo(false);
    }
  };

  const guardar = async () => {
    const st = aNumero(subtotal);
    if (!archivo) return toast({ title: "Falta la factura", description: "Sube el PDF o la foto de la factura.", variant: "destructive" });
    if (!numero.trim()) return toast({ title: "Falta el número de factura", variant: "destructive" });
    if (!fecha) return toast({ title: "Falta la fecha de la factura", variant: "destructive" });
    if (!st || st <= 0) return toast({ title: "Falta el subtotal (antes de IVA)", variant: "destructive" });

    const factura: Factura = {
      fecha,
      subtotal: st,
      iva: aNumero(iva),
      total: aNumero(total),
      archivo,
      registradaPor: user?.email ?? null,
      registradaEn: new Date().toISOString(),
    };
    setGuardando(true);
    try {
      await onGuardar({ numFactura: numero.trim(), factura });
      // Se comprueba en la base, igual que los costos: el guardado del panel
      // no avisa cuando falla.
      const { data, error } = await supabase
        .from("projects")
        .select("num_factura, factura_subtotal, factura_fecha, factura_archivo")
        .eq("id", proyecto.id)
        .single();
      const row = data as { num_factura?: string; factura_subtotal?: number; factura_fecha?: string; factura_archivo?: { filePath?: string } } | null;
      if (
        error ||
        row?.num_factura !== numero.trim() ||
        Number(row?.factura_subtotal) !== st ||
        row?.factura_fecha !== fecha ||
        row?.factura_archivo?.filePath !== archivo.filePath
      ) {
        throw new Error("La base no quedó con la factura. Revisa la conexión y vuelve a guardar.");
      }
      toast({
        title: "✓ Factura guardada",
        description: `${numero.trim()} · ${pesos(st)} antes de IVA · ${fecha}. Ya cuenta en ventas reales.`,
      });
      onClose();
    } catch (e) {
      toast({ title: "No se guardó", description: e instanceof Error ? e.message : "Intenta de nuevo", variant: "destructive" });
    } finally {
      setGuardando(false);
    }
  };

  const quitar = async () => {
    if (!window.confirm("¿Quitar la factura de este evento? Dejará de contar en ventas reales.")) return;
    setGuardando(true);
    try {
      await onGuardar({ factura: null });
      toast({ title: "Factura quitada" });
      onClose();
    } finally {
      setGuardando(false);
    }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && !guardando && !leyendo && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <Receipt className="h-4 w-4" /> Factura · {proyecto.evento || "Sin nombre"}
          </DialogTitle>
          <DialogDescription className="text-left">
            Solo con la factura subida el evento cuenta en <strong>ventas reales</strong> (con su
            subtotal y en la fecha en que se facturó). Lo cotizado sigue siendo la venta estimada.
          </DialogDescription>
        </DialogHeader>

        {!editando && actual?.archivo ? (
          <div className="space-y-3 text-sm">
            <div className="grid grid-cols-2 gap-2 rounded-lg border p-3">
              <Dato k="Número" v={proyecto.numFactura || "—"} />
              <Dato k="Fecha" v={actual.fecha || "—"} />
              <Dato k="Subtotal" v={pesos(actual.subtotal)} />
              <Dato k="IVA" v={pesos(actual.iva)} />
              <Dato k="Total" v={pesos(actual.total)} />
              <Dato k="Registró" v={actual.registradaPor || "—"} />
            </div>
            <Button variant="outline" className="w-full gap-2" onClick={() => verPdf(actual.archivo)}>
              <ExternalLink className="h-4 w-4" /> Ver factura
            </Button>
            {!soloLectura && (
              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" onClick={() => setEditando(true)}>
                  Reemplazar
                </Button>
                <Button variant="ghost" className="text-destructive" onClick={quitar} disabled={guardando}>
                  <Trash2 className="mr-1 h-4 w-4" /> Quitar
                </Button>
              </div>
            )}
          </div>
        ) : soloLectura ? (
          <p className="text-sm text-muted-foreground">
            {proyecto.numFactura
              ? `Número ${proyecto.numFactura}, pero sin la factura subida: no cuenta en ventas reales.`
              : "Este evento todavía no tiene factura."}
          </p>
        ) : (
          <div className="space-y-3">
            {proyecto.numFactura && !actual?.archivo && (
              <p className="rounded-md bg-amber-500/10 p-2 text-xs text-amber-600">
                Tiene el número {proyecto.numFactura} escrito, pero falta la factura. Súbela para que
                cuente como venta real.
              </p>
            )}
            <input
              ref={inputRef}
              type="file"
              accept="application/pdf,image/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void alElegir(file);
                e.target.value = "";
              }}
            />
            <Button
              variant={archivo ? "outline" : "default"}
              className="w-full gap-2"
              disabled={leyendo}
              onClick={() => inputRef.current?.click()}
            >
              {leyendo ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              {leyendo ? "Subiendo y leyendo la factura…" : archivo ? `Cambiar archivo (${archivo.name})` : "Subir factura (PDF o foto)"}
            </Button>
            {aviso && <p className="text-xs text-muted-foreground">{aviso}</p>}

            <div className="grid grid-cols-2 gap-2">
              <Campo label="Número de factura" value={numero} onChange={setNumero} />
              <div className="space-y-1">
                <Label className="text-xs">Fecha de la factura</Label>
                <Input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} className="h-9" />
              </div>
              <Campo label="Subtotal (antes de IVA)" value={subtotal} onChange={setSubtotal} numerico />
              <Campo label="IVA" value={iva} onChange={setIva} numerico />
              <Campo label="Total" value={total} onChange={setTotal} numerico />
            </div>
          </div>
        )}

        {editando && !soloLectura && (
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={onClose} disabled={guardando || leyendo}>
              Cancelar
            </Button>
            <Button onClick={guardar} disabled={guardando || leyendo || !archivo}>
              {guardando && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {guardando ? "Guardando y comprobando…" : "Guardar factura"}
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}

function Dato({ k, v }: { k: string; v: string }) {
  return (
    <div>
      <div className="text-[10px] uppercase text-muted-foreground">{k}</div>
      <div className="truncate font-medium">{v}</div>
    </div>
  );
}

function Campo({
  label,
  value,
  onChange,
  numerico,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  numerico?: boolean;
}) {
  return (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        inputMode={numerico ? "decimal" : undefined}
        className="h-9"
      />
    </div>
  );
}
