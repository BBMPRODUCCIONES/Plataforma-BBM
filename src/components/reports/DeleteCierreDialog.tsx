import { useState } from "react";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface DeleteCierreDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cierreId: string;
  onDeleted: () => void;
}

export default function DeleteCierreDialog({ open, onOpenChange, cierreId, onDeleted }: DeleteCierreDialogProps) {
  const [password, setPassword] = useState("");
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);

  const handleDelete = async () => {
    if (!password.trim()) {
      toast.error("Debes ingresar tu contraseña");
      return;
    }
    if (!reason.trim()) {
      toast.error("Debes ingresar el motivo de la eliminación");
      return;
    }

    setLoading(true);
    try {
      // Verify password
      const { data: userData } = await supabase.auth.getUser();
      const email = userData?.user?.email;
      if (!email) {
        toast.error("No se pudo obtener el usuario actual");
        setLoading(false);
        return;
      }

      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (signInError) {
        toast.error("Contraseña incorrecta");
        setLoading(false);
        return;
      }

      // Get employee name
      let deletedByName = email;
      const { data: empData } = await supabase.rpc("get_my_employee");
      if (empData && empData.length > 0) deletedByName = empData[0].nombre;

      // Soft delete
      const { error } = await supabase
        .from("caja_menor_cierres")
        .update({
          deleted_at: new Date().toISOString(),
          deleted_by: deletedByName,
          deleted_by_email: email,
          deleted_reason: reason.trim(),
        } as any)
        .eq("id", cierreId);

      if (error) {
        toast.error("Error al eliminar: " + error.message);
      } else {
        toast.success("Cierre eliminado correctamente");
        onDeleted();
        onOpenChange(false);
      }
    } catch {
      toast.error("Error inesperado");
    } finally {
      setLoading(false);
      setPassword("");
      setReason("");
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Eliminar cierre de caja</AlertDialogTitle>
          <AlertDialogDescription>
            Esta acción marcará el cierre como eliminado. Ingresa tu contraseña y el motivo.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="space-y-4 py-2">
          {/* Hidden field to prevent autofill */}
          <input type="text" className="hidden" autoComplete="username" tabIndex={-1} />
          
          <div className="space-y-2">
            <Label>Contraseña</Label>
            <Input
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Ingresa tu contraseña"
            />
          </div>
          <div className="space-y-2">
            <Label>¿Por qué se elimina este cierre?</Label>
            <Textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Motivo de la eliminación..."
              rows={3}
            />
          </div>
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel disabled={loading}>Cancelar</AlertDialogCancel>
          <Button
            variant="destructive"
            onClick={handleDelete}
            disabled={loading || !password.trim() || !reason.trim()}
          >
            {loading ? "Eliminando..." : "Eliminar"}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
