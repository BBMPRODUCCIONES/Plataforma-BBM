import { useCallback, useEffect, useState } from "react";
import { CheckCircle2, ClipboardList } from "lucide-react";
import { toast } from "sonner";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

/**
 * "Mis tareas" en la barra superior: las tareas que Bayron le asigno a quien
 * esta mirando y que siguen pendientes. Aqui las marca como hechas; la base
 * guarda cuando y quien (para medir si fue a tiempo).
 */
interface Tarea {
  id: string;
  titulo: string;
  descripcion: string;
  fecha_limite: string | null;
}

const hoy = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Bogota" }).format(new Date());
const fechaCorta = (d: string) =>
  new Date(`${d}T12:00:00Z`).toLocaleDateString("es-CO", { day: "numeric", month: "short", timeZone: "UTC" });

export function MisTareas({ compacto = false }: { compacto?: boolean }) {
  const { user } = useAuth();
  const [tareas, setTareas] = useState<Tarea[]>([]);
  const [abierto, setAbierto] = useState(false);

  const cargar = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from("tareas" as never)
      .select("id, titulo, descripcion, fecha_limite")
      .eq("asignada_a", user.id)
      .eq("estado", "pendiente")
      .order("fecha_limite", { ascending: true, nullsFirst: false });
    setTareas((data as unknown as Tarea[]) || []);
  }, [user]);

  useEffect(() => {
    if (!user) return;
    void cargar();
    const canal = supabase
      .channel(`mis-tareas:${user.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "tareas", filter: `asignada_a=eq.${user.id}` }, (payload) => {
        if (payload.eventType === "INSERT") {
          const t = payload.new as Tarea;
          toast.info("Nueva tarea asignada", { description: t.titulo, duration: 8000 });
        }
        void cargar();
      })
      .subscribe();
    const alVolver = () => document.visibilityState === "visible" && void cargar();
    document.addEventListener("visibilitychange", alVolver);
    return () => {
      supabase.removeChannel(canal);
      document.removeEventListener("visibilitychange", alVolver);
    };
  }, [user, cargar]);

  const marcarHecha = async (t: Tarea) => {
    setTareas((prev) => prev.filter((x) => x.id !== t.id));
    const { error } = await supabase.from("tareas" as never).update({ estado: "hecha" } as never).eq("id", t.id);
    if (error) {
      toast.error("No se pudo marcar", { description: error.message });
      void cargar();
    } else toast.success("Tarea hecha", { description: t.titulo });
  };

  if (tareas.length === 0) return null;
  const h = hoy();
  const vencidas = tareas.filter((t) => t.fecha_limite && t.fecha_limite < h).length;

  return (
    <Popover open={abierto} onOpenChange={setAbierto}>
      <PopoverTrigger asChild>
        <button
          type="button"
          title="Tareas que te asignaron"
          className={cn(
            "inline-flex shrink-0 items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium ring-1 ring-inset transition-colors",
            vencidas
              ? "bg-destructive/10 text-destructive ring-destructive/40 hover:bg-destructive/20"
              : "bg-sky-500/10 text-sky-500 ring-sky-500/40 hover:bg-sky-500/20"
          )}
        >
          <ClipboardList className="h-3.5 w-3.5" />
          {tareas.length}
          {!compacto && (tareas.length === 1 ? " tarea" : " tareas")}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[min(92vw,24rem)] p-3">
        <p className="mb-2 text-sm font-semibold">Mis tareas</p>
        <ul className="-mx-1 max-h-[60vh] divide-y divide-border overflow-y-auto">
          {tareas.map((t) => {
            const v = t.fecha_limite && t.fecha_limite < h;
            return (
              <li key={t.id} className="flex items-start gap-2 px-1 py-2">
                <div className="min-w-0 flex-1">
                  <p className="text-sm">{t.titulo}</p>
                  {t.descripcion && <p className="text-xs text-muted-foreground">{t.descripcion}</p>}
                  {t.fecha_limite && (
                    <p className={cn("text-xs", v ? "font-semibold text-destructive" : "text-muted-foreground")}>
                      {v ? "Vencida: " : "Para el "}
                      {fechaCorta(t.fecha_limite)}
                    </p>
                  )}
                </div>
                <Button size="sm" variant="outline" className="h-7 shrink-0 gap-1 text-xs" onClick={() => marcarHecha(t)}>
                  <CheckCircle2 className="h-3.5 w-3.5" /> Hecha
                </Button>
              </li>
            );
          })}
        </ul>
      </PopoverContent>
    </Popover>
  );
}
