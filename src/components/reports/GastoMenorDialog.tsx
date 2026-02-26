import { useState, useEffect, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useAuth } from "@/contexts/AuthContext";
import { CATEGORIAS_EVENTOS, CATEGORIAS_ADMIN } from "@/hooks/useGastosMenores";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Upload, Loader2, ChevronsUpDown, Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface GastoMenorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (gasto: {
    centro_costos: string;
    evento_id: string | null;
    usuario_id: string;
    usuario_nombre: string;
    concepto: string;
    categoria: string;
    valor: number;
    imagen_url: string | null;
    estado: string;
    nombre_comercio: string;
    nit_cc: string;
    tipo_centro: string;
  }) => Promise<boolean>;
  centroCostosDefault?: string;
  eventoId?: string | null;
}

export default function GastoMenorDialog({ open, onOpenChange, onSubmit, centroCostosDefault = "", eventoId = null }: GastoMenorDialogProps) {
  const { user } = useAuth();
  const [concepto, setConcepto] = useState("");
  const [centroCostos, setCentroCostos] = useState(centroCostosDefault || "");
  const [categoria, setCategoria] = useState("");
  const [valor, setValor] = useState("");
  const [imagenUrl, setImagenUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [userName, setUserName] = useState("");
  const [ccOpen, setCcOpen] = useState(false);
  const [centrosCostos, setCentrosCostos] = useState<{ value: string; evento: string }[]>([]);
  const [nombreComercio, setNombreComercio] = useState("");
  const [nitCc, setNitCc] = useState("");

  // Determine tipo_centro based on selected centro de costos
  const tipoCentro = useMemo(() => {
    if (!centroCostos) return "eventos";
    const norm = centroCostos.toLowerCase();
    if (norm.includes("admin") || norm.includes("ti ") || norm.startsWith("ti")) return "admin";
    return "eventos";
  }, [centroCostos]);

  const categoriasDisponibles = tipoCentro === "admin" ? CATEGORIAS_ADMIN : CATEGORIAS_EVENTOS;

  // Reset categoria when tipo changes
  useEffect(() => {
    if (categoria && !(categoriasDisponibles as readonly string[]).includes(categoria)) {
      setCategoria("");
    }
  }, [tipoCentro]);

  // Fetch user name on mount
  useState(() => {
    if (user?.email) {
      supabase.rpc("get_my_employee").then(({ data }) => {
        if (data && data.length > 0) {
          setUserName(data[0].nombre);
        } else {
          setUserName(user.email || "");
        }
      });
    }
  });

  // Fetch unique centro_costos from projects
  useEffect(() => {
    const fetchCentrosCostos = async () => {
      const { data, error } = await supabase
        .from("projects")
        .select("centro_costos, evento")
        .eq("is_deleted", false)
        .neq("centro_costos", "");
      if (!error && data) {
        const unique = new Map<string, string>();
        data.forEach((p) => {
          if (p.centro_costos && p.centro_costos.trim()) {
            unique.set(p.centro_costos.trim(), p.evento || "Sin evento");
          }
        });
        setCentrosCostos(
          Array.from(unique.entries()).map(([value, evento]) => ({ value, evento }))
        );
      }
    };
    if (open) fetchCentrosCostos();
  }, [open]);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const ext = file.name.split(".").pop();
      const path = `gastos-menores/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      const { error } = await supabase.storage.from("notes-images").upload(path, file);
      if (error) throw error;
      const { data: urlData } = supabase.storage.from("notes-images").getPublicUrl(path);
      setImagenUrl(urlData.publicUrl);
    } catch (err: any) {
      toast.error("Error al subir imagen: " + err.message);
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async () => {
    if (!centroCostos.trim()) { toast.error("El centro de costos es obligatorio"); return; }
    if (!concepto.trim()) { toast.error("El concepto es obligatorio"); return; }
    if (!categoria) { toast.error("La categoría es obligatoria"); return; }
    if (!valor || Number(valor) <= 0) { toast.error("El valor debe ser mayor a 0"); return; }
    if (!imagenUrl) { toast.error("La imagen es obligatoria"); return; }
    if (!nombreComercio.trim()) { toast.error("El nombre del comercio es obligatorio"); return; }
    if (!nitCc.trim()) { toast.error("El NIT/CC es obligatorio"); return; }

    setSubmitting(true);
    const success = await onSubmit({
      centro_costos: centroCostos.trim(),
      evento_id: eventoId,
      usuario_id: user?.id || "",
      usuario_nombre: userName || user?.email || "",
      concepto: concepto.trim(),
      categoria,
      valor: Number(valor),
      imagen_url: imagenUrl,
      estado: "Pendiente",
      nombre_comercio: nombreComercio.trim(),
      nit_cc: nitCc.trim(),
      tipo_centro: tipoCentro,
    });

    if (success) {
      setConcepto("");
      setCentroCostos(centroCostosDefault || "");
      setCategoria("");
      setValor("");
      setImagenUrl(null);
      setNombreComercio("");
      setNitCc("");
      onOpenChange(false);
    }
    setSubmitting(false);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => {
        if (!v) {
          const hasData = concepto.trim() || categoria || (valor && Number(valor) > 0);
          if (hasData && (!centroCostos.trim() || !concepto.trim() || !categoria || !valor || Number(valor) <= 0)) {
            toast.error("Completa todos los campos obligatorios antes de salir");
            return;
          }
        }
        onOpenChange(v);
      }}>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Registrar Gasto Menor</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {/* Usuario */}
          <div className="space-y-1.5">
            <Label>Usuario</Label>
            <Input value={userName || user?.email || ""} disabled className="bg-muted" />
          </div>

          {/* Centro de Costos */}
          <div className="space-y-1.5">
            <Label>Centro de Costos *</Label>
            <Popover open={ccOpen} onOpenChange={setCcOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline" role="combobox" aria-expanded={ccOpen} className="w-full justify-between font-normal">
                  {centroCostos || "Seleccionar centro de costos"}
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                <Command>
                  <CommandInput placeholder="Buscar centro de costos..." />
                  <CommandList>
                    <CommandEmpty>No se encontraron centros de costos</CommandEmpty>
                    <CommandGroup>
                      {centrosCostos.map((cc) => (
                        <CommandItem
                          key={cc.value}
                          value={cc.value}
                          onSelect={(val) => {
                            setCentroCostos(val === centroCostos ? "" : cc.value);
                            setCcOpen(false);
                          }}
                        >
                          <Check className={cn("mr-2 h-4 w-4", centroCostos === cc.value ? "opacity-100" : "opacity-0")} />
                          <div className="flex flex-col">
                            <span>{cc.value}</span>
                            <span className="text-xs text-muted-foreground">{cc.evento}</span>
                          </div>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
            {centroCostos && (
              <p className="text-[11px] text-muted-foreground">
                Tipo: <span className="font-medium capitalize">{tipoCentro}</span>
              </p>
            )}
          </div>

          {/* Concepto */}
          <div className="space-y-1.5">
            <Label>Concepto *</Label>
            <Input value={concepto} onChange={(e) => setConcepto(e.target.value)} placeholder="Descripción del gasto" />
          </div>

          {/* Categoría - dynamic based on tipo_centro */}
          <div className="space-y-1.5">
            <Label>Categoría *</Label>
            <Select value={categoria} onValueChange={setCategoria}>
              <SelectTrigger>
                <SelectValue placeholder="Seleccionar categoría" />
              </SelectTrigger>
              <SelectContent>
                {categoriasDisponibles.map((cat) => (
                  <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Nombre del Comercio */}
          <div className="space-y-1.5">
            <Label>Nombre del comercio *</Label>
            <Input value={nombreComercio} onChange={(e) => setNombreComercio(e.target.value)} placeholder="Nombre del establecimiento" />
          </div>

          {/* NIT/CC */}
          <div className="space-y-1.5">
            <Label>NIT / CC *</Label>
            <Input value={nitCc} onChange={(e) => setNitCc(e.target.value)} placeholder="NIT o cédula del comercio" />
          </div>

          {/* Valor */}
          <div className="space-y-1.5">
            <Label>Valor *</Label>
            <Input type="number" value={valor} onChange={(e) => setValor(e.target.value)} placeholder="0" min={0} />
          </div>

          {/* Imagen */}
          <div className="space-y-1.5">
            <Label>Imagen (recibo/factura) *</Label>
            <div className="flex items-center gap-2">
              <label className="flex items-center gap-2 cursor-pointer px-3 py-2 border rounded-md text-sm hover:bg-accent transition-colors">
                <Upload className="h-4 w-4" />
                {imagenUrl ? "Cambiar imagen" : "Subir imagen"}
                <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
              </label>
              {uploading && <Loader2 className="h-4 w-4 animate-spin" />}
              {imagenUrl && <span className="text-xs text-green-500">✓ Imagen cargada</span>}
            </div>
          </div>

          <Button onClick={handleSubmit} disabled={submitting} className="w-full">
            {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Registrar Gasto
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
