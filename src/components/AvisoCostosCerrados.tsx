import { useCallback, useEffect, useState } from "react";
import { Lock } from "lucide-react";
import { toast } from "sonner";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

/**
 * Aviso "Costos cerrados por AUX BBM" en la barra superior.
 *
 * Cuando auxbbm@ cierra los costos de un evento, la base deja una
 * notificacion (tipo costos_cerrados) a todo el equipo. Aqui se muestran las que no se han leido, con un mensaje emergente
 * si llega una mientras la app esta abierta. "Entendido" las marca leidas.
 */
interface Aviso {
  id: string;
  title: string;
  message: string;
  created_at: string;
  data: { tipo?: string; evento?: string } | null;
}

export function AvisoCostosCerrados({ compacto = false }: { compacto?: boolean }) {
  const { user } = useAuth();
  const [avisos, setAvisos] = useState<Aviso[]>([]);
  const [abierto, setAbierto] = useState(false);

  const cargar = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from("notifications")
      .select("id, title, message, created_at, data")
      .eq("user_id", user.id)
      .eq("read", false)
      .contains("data", { tipo: "costos_cerrados" })
      .order("created_at", { ascending: false })
      .limit(50);
    setAvisos((data as Aviso[]) || []);
  }, [user]);

  useEffect(() => {
    if (!user) return;
    void cargar();
    const canal = supabase
      .channel(`costos-cerrados:${user.id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` },
        (payload) => {
          const n = payload.new as Aviso;
          if (n.data?.tipo !== "costos_cerrados") return;
          setAvisos((prev) => [n, ...prev.filter((a) => a.id !== n.id)]);
          toast.info(n.title, { description: n.message, duration: 8000 });
        }
      )
      .subscribe();
    const alVolver = () => document.visibilityState === "visible" && void cargar();
    document.addEventListener("visibilitychange", alVolver);
    return () => {
      supabase.removeChannel(canal);
      document.removeEventListener("visibilitychange", alVolver);
    };
  }, [user, cargar]);

  const marcarLeidas = async () => {
    const ids = avisos.map((a) => a.id);
    setAvisos([]);
    setAbierto(false);
    if (ids.length) await supabase.from("notifications").update({ read: true }).in("id", ids);
  };

  if (avisos.length === 0) return null;

  return (
    <Popover open={abierto} onOpenChange={setAbierto}>
      <PopoverTrigger asChild>
        <button
          type="button"
          title="Eventos con costos cerrados"
          className="inline-flex shrink-0 items-center gap-1.5 rounded-md bg-emerald-500/10 px-2 py-1 text-xs font-medium text-emerald-500 ring-1 ring-inset ring-emerald-500/40 transition-colors hover:bg-emerald-500/20"
        >
          <Lock className="h-3.5 w-3.5" />
          {avisos.length}
          {!compacto && (avisos.length === 1 ? " costos cerrados" : " eventos con costos cerrados")}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[min(92vw,26rem)] p-3">
        <p className="mb-2 text-sm font-semibold">Costos cerrados</p>
        <ul className="-mx-1 max-h-[60vh] divide-y divide-border overflow-y-auto">
          {avisos.map((a) => (
            <li key={a.id} className="px-1 py-2">
              <p className="text-sm">{a.message}</p>
              <p className="text-[11px] text-muted-foreground">
                {new Date(a.created_at).toLocaleString("es-CO", { timeZone: "America/Bogota", dateStyle: "medium", timeStyle: "short" })}
              </p>
            </li>
          ))}
        </ul>
        <Button size="sm" className="mt-2 w-full" onClick={marcarLeidas}>
          Entendido
        </Button>
      </PopoverContent>
    </Popover>
  );
}
