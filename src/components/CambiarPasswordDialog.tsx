import { useEffect, useState } from "react";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Eye, EyeOff, KeyRound, Loader2, LogOut } from "lucide-react";
import PasswordStrengthIndicator, { isPasswordValid } from "@/components/PasswordStrengthIndicator";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

interface Props {
  /**
   * `obligado` es cuando la persona entro con una contraseña temporal: no
   * puede cerrar la ventana ni seguir usando el planner hasta elegir una suya.
   * Si pudiera cerrarla, la contraseña que el administrador conoce seguiria
   * sirviendo indefinidamente, que es justo lo que se quiere evitar.
   */
  obligado?: boolean;
  abierto?: boolean;
  onCerrar?: () => void;
}

export function CambiarPasswordDialog({ obligado = false, abierto = true, onCerrar }: Props) {
  const { signOut } = useAuth();
  const [clave, setClave] = useState("");
  const [confirmar, setConfirmar] = useState("");
  const [verClave, setVerClave] = useState(false);
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    if (abierto) { setClave(""); setConfirmar(""); setVerClave(false); }
  }, [abierto]);

  const coinciden = clave.length > 0 && clave === confirmar;
  const sirve = isPasswordValid(clave) && coinciden;

  const guardar = async () => {
    if (!sirve) return;
    setGuardando(true);

    // La bandera se limpia en la MISMA llamada que cambia la contraseña. Si
    // fueran dos pasos, uno podria fallar y dejar a la persona encerrada en
    // esta pantalla, o peor, liberada sin haber cambiado nada.
    const { error } = await supabase.auth.updateUser({
      password: clave,
      data: { debe_cambiar_password: false },
    });

    setGuardando(false);

    if (error) {
      const mismaDeAntes = error.message?.includes("should be different");
      toast.error("No se pudo cambiar la contraseña", {
        description: mismaDeAntes
          ? "La nueva tiene que ser distinta de la que estás usando."
          : error.message,
      });
      return;
    }

    toast.success("Contraseña cambiada", {
      description: "La próxima vez entra con la nueva.",
    });
    setClave(""); setConfirmar("");
    onCerrar?.();
  };

  return (
    <Dialog
      open={abierto}
      onOpenChange={(v) => { if (!v && !obligado) onCerrar?.(); }}
    >
      <DialogContent
        // En modo obligado se tapan las tres salidas de Radix: la X (que el
        // DialogContent compartido siempre dibuja, por eso se oculta con
        // CSS en vez de con una prop), el clic afuera y la tecla Escape.
        className={obligado ? "max-w-md [&>button.absolute]:hidden" : "max-w-md"}
        onPointerDownOutside={(e) => { if (obligado) e.preventDefault(); }}
        onEscapeKeyDown={(e) => { if (obligado) e.preventDefault(); }}
        onInteractOutside={(e) => { if (obligado) e.preventDefault(); }}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <KeyRound className="h-4 w-4" />
            {obligado ? "Elige tu contraseña" : "Cambiar contraseña"}
          </DialogTitle>
          <DialogDescription className="text-left">
            {obligado
              ? "Entraste con una contraseña temporal que otra persona te asignó. Para seguir, elige una que solo conozcas tú."
              : "La nueva reemplaza a la actual en todos tus dispositivos."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div>
            <Label htmlFor="clave-nueva">Nueva contraseña</Label>
            <div className="relative">
              <Input
                id="clave-nueva"
                type={verClave ? "text" : "password"}
                value={clave}
                autoComplete="new-password"
                onChange={(e) => setClave(e.target.value)}
              />
              <button
                type="button"
                aria-label={verClave ? "Ocultar contraseña" : "Mostrar contraseña"}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground"
                onClick={() => setVerClave((v) => !v)}
              >
                {verClave ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            <div className="mt-2">
              <PasswordStrengthIndicator password={clave} />
            </div>
          </div>

          <div>
            <Label htmlFor="clave-confirmar">Repítela</Label>
            <Input
              id="clave-confirmar"
              type={verClave ? "text" : "password"}
              value={confirmar}
              autoComplete="new-password"
              onChange={(e) => setConfirmar(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && sirve) void guardar(); }}
            />
            {confirmar.length > 0 && !coinciden && (
              <p className="mt-1 text-xs text-destructive">Las dos no son iguales.</p>
            )}
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          {obligado ? (
            // Sin escape, pero tampoco encerrado: siempre tiene que poder
            // salirse de la sesion.
            <Button variant="ghost" onClick={() => void signOut()}>
              <LogOut className="mr-2 h-4 w-4" />Salir
            </Button>
          ) : (
            <Button variant="outline" onClick={onCerrar}>Cancelar</Button>
          )}
          <Button onClick={guardar} disabled={!sirve || guardando}>
            {guardando && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Guardar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
