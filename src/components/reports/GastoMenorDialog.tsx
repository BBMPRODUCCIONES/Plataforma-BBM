import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/contexts/AuthContext";
import { CATEGORIAS_GASTOS_MENORES } from "@/hooks/useGastosMenores";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Upload, Loader2 } from "lucide-react";

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
  }) => Promise<boolean>;
  centroCostos?: string;
  eventoId?: string | null;
}

export default function GastoMenorDialog({ open, onOpenChange, onSubmit, centroCostos = "", eventoId = null }: GastoMenorDialogProps) {
  const { user } = useAuth();
  const [concepto, setConcepto] = useState("");
  const [categoria, setCategoria] = useState("");
  const [valor, setValor] = useState("");
  const [imagenUrl, setImagenUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [userName, setUserName] = useState("");

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
    if (!concepto.trim()) { toast.error("El concepto es obligatorio"); return; }
    if (!categoria) { toast.error("La categoría es obligatoria"); return; }
    if (!valor || Number(valor) <= 0) { toast.error("El valor debe ser mayor a 0"); return; }

    setSubmitting(true);
    const success = await onSubmit({
      centro_costos: centroCostos,
      evento_id: eventoId,
      usuario_id: user?.id || "",
      usuario_nombre: userName || user?.email || "",
      concepto: concepto.trim(),
      categoria,
      valor: Number(valor),
      imagen_url: imagenUrl,
      estado: "Pendiente",
    });

    if (success) {
      setConcepto("");
      setCategoria("");
      setValor("");
      setImagenUrl(null);
      onOpenChange(false);
    }
    setSubmitting(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Registrar Gasto Menor</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {/* Usuario - auto */}
          <div className="space-y-1.5">
            <Label>Usuario</Label>
            <Input value={userName || user?.email || ""} disabled className="bg-muted" />
          </div>

          {/* Concepto */}
          <div className="space-y-1.5">
            <Label>Concepto *</Label>
            <Input value={concepto} onChange={(e) => setConcepto(e.target.value)} placeholder="Descripción del gasto" />
          </div>

          {/* Categoría */}
          <div className="space-y-1.5">
            <Label>Categoría *</Label>
            <Select value={categoria} onValueChange={setCategoria}>
              <SelectTrigger>
                <SelectValue placeholder="Seleccionar categoría" />
              </SelectTrigger>
              <SelectContent>
                {CATEGORIAS_GASTOS_MENORES.map((cat) => (
                  <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Valor */}
          <div className="space-y-1.5">
            <Label>Valor *</Label>
            <Input
              type="number"
              value={valor}
              onChange={(e) => setValor(e.target.value)}
              placeholder="0"
              min={0}
            />
          </div>

          {/* Imagen */}
          <div className="space-y-1.5">
            <Label>Imagen (recibo/factura)</Label>
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
