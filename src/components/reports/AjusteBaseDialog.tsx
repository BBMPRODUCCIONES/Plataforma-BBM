import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

interface AjusteBaseDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentBase: number;
  currentReembolso: number;
  saldoEnCaja: number;
  onSave: (newBase: number, newReembolso: number) => Promise<boolean>;
}

export default function AjusteBaseDialog({
  open,
  onOpenChange,
  currentBase,
  currentReembolso,
  saldoEnCaja,
  onSave,
}: AjusteBaseDialogProps) {
  const { user } = useAuth();
  const [userName, setUserName] = useState("");
  const [baseValue, setBaseValue] = useState("");
  const [reembolsoValue, setReembolsoValue] = useState("");
  const [saving, setSaving] = useState(false);
  const now = new Date();

  useEffect(() => {
    if (open) {
      setBaseValue(String(currentBase));
      setReembolsoValue(String(currentReembolso));
      // Fetch employee name
      (async () => {
        const { data } = await supabase.rpc("get_my_employee");
        if (data && data.length > 0) {
          setUserName(data[0].nombre);
        } else {
          setUserName(user?.email || "Usuario");
        }
      })();
    }
  }, [open, currentBase, currentReembolso, user]);

  const fmt = (v: number) => new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", minimumFractionDigits: 0 }).format(v);

  const handleSave = async () => {
    setSaving(true);
    const newReembolso = Number(reembolsoValue) || 0;
    const success = await onSave(Number(baseValue) || 0, newReembolso);
    setSaving(false);
    if (success) {
      onOpenChange(false);
      // Informative toast with details of the change
      const { toast } = await import("sonner");
      toast.success("Reembolso registrado", {
        description: `${userName} registró un reembolso de ${fmt(newReembolso)} el ${format(new Date(), "dd/MM/yyyy HH:mm", { locale: es })}`,
        duration: 5000,
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md [&>button]:right-12">
        <DialogHeader>
          <DialogTitle className="text-base">Ajuste de Base Asignada</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          {/* Auto-logged user */}
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Usuario</Label>
            <Input value={userName} readOnly className="bg-muted/50 text-sm" />
          </div>

          {/* Auto date */}
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Fecha</Label>
            <Input
              value={format(now, "dd/MM/yyyy HH:mm", { locale: es })}
              readOnly
              className="bg-muted/50 text-sm"
            />
          </div>

          {/* Base asignada - read only, shows saldo en caja */}
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Base Asignada (Saldo en caja)</Label>
            <Input
              value={new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", minimumFractionDigits: 0 }).format(saldoEnCaja)}
              readOnly
              className="bg-muted/50 text-sm"
            />
          </div>

          {/* Reembolsado */}
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Reembolsado</Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">$</span>
              <Input
                type="text"
                inputMode="numeric"
                value={reembolsoValue ? Number(reembolsoValue).toLocaleString("es-CO") : ""}
                onChange={(e) => {
                  const raw = e.target.value.replace(/\D/g, "");
                  setReembolsoValue(raw);
                }}
                placeholder="0"
                className="text-sm pl-7"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button size="sm" onClick={handleSave} disabled={saving}>
              {saving ? "Guardando..." : "Guardar"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
