import { useMemo, useState } from "react";
import { ClipboardCheck, Loader2 } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/contexts/AuthContext";
import { useProjects } from "@/contexts/ProjectsContext";
import { CostosEventoDialog } from "@/components/CostosEventoDialog";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { CostoEvento, Project } from "@/types";
import {
  costosPorVerificar,
  esResponsableCostos,
  estadoVerificacion,
  faltaCentroCostos,
} from "@/lib/permisosCostos";

/**
 * Aviso para auxbbm@ en la barra superior: costos por verificar y centros de
 * costos por subir. Solo lo ve el responsable.
 */
const fechaCorta = (v?: string) => {
  if (!v) return "Sin fecha";
  const d = new Date(`${v.slice(0, 10)}T00:00:00`);
  return isNaN(d.getTime()) ? v : d.toLocaleDateString("es-CO", { day: "numeric", month: "short" });
};
const porFecha = (a: Project, b: Project) =>
  (a.fechaEjecucionInicio || "").localeCompare(b.fechaEjecucionInicio || "");

export function AvisoCostosPendientes({ compacto = false }: { compacto?: boolean }) {
  const { user } = useAuth();
  const { projects, updateProject } = useProjects();
  const [abierto, setAbierto] = useState(false);
  const [vista, setVista] = useState<"costos" | "centros">("costos");
  // La ventana de costos va fuera del popover para que no se cierre con el.
  const [costosDe, setCostosDe] = useState<string | null>(null);
  const responsable = esResponsableCostos(user?.email);

  const porVerificar = useMemo(
    () => (responsable ? projects.filter(costosPorVerificar).sort(porFecha) : []),
    [projects, responsable]
  );
  const sinCentro = useMemo(
    () => (responsable ? projects.filter(faltaCentroCostos).sort(porFecha) : []),
    [projects, responsable]
  );
  const total = porVerificar.length + sinCentro.length;
  const elegido = costosDe ? projects.find((p) => p.id === costosDe) ?? null : null;

  if (!responsable || (total === 0 && !elegido)) return null;

  const vistaReal = vista === "costos" && porVerificar.length === 0 ? "centros" : vista === "centros" && sinCentro.length === 0 ? "costos" : vista;

  return (
    <>
      {total > 0 && (
        <Popover open={abierto} onOpenChange={setAbierto}>
          <PopoverTrigger asChild>
            <button
              type="button"
              title={`${porVerificar.length} costos sin verificar · ${sinCentro.length} centros de costos por subir`}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-md bg-amber-500/10 px-2 py-1 text-xs font-medium text-amber-500 ring-1 ring-inset ring-amber-500/40 transition-colors hover:bg-amber-500/20"
            >
              <ClipboardCheck className="h-3.5 w-3.5 animate-pulse" />
              {compacto
                ? total
                : [
                    porVerificar.length > 0 && `${porVerificar.length} costos sin verificar`,
                    sinCentro.length > 0 && `${sinCentro.length} sin centro de costos`,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
            </button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-[min(92vw,28rem)] p-3">
            <div className="mb-2 flex gap-1">
              <Button
                size="sm"
                variant={vistaReal === "costos" ? "secondary" : "ghost"}
                className="h-7 text-xs"
                disabled={porVerificar.length === 0}
                onClick={() => setVista("costos")}
              >
                Costos sin verificar ({porVerificar.length})
              </Button>
              <Button
                size="sm"
                variant={vistaReal === "centros" ? "secondary" : "ghost"}
                className="h-7 text-xs"
                disabled={sinCentro.length === 0}
                onClick={() => setVista("centros")}
              >
                Centros de costos ({sinCentro.length})
              </Button>
            </div>

            {vistaReal === "costos" ? (
              <>
                <p className="mb-1 text-xs text-muted-foreground">
                  Eventos con costos cargados que falta revisar. "Revisar" abre los costos; ahí está el
                  check "Verifiqué los costos".
                </p>
                <ul className="-mx-1 max-h-[60vh] divide-y divide-border overflow-y-auto">
                  {porVerificar.map((p) => (
                    <li key={p.id} className="flex items-center gap-2 px-1 py-2">
                      <span className="w-14 shrink-0 text-xs tabular-nums text-muted-foreground">
                        {fechaCorta(p.fechaEjecucionInicio)}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm">{p.evento || "Sin nombre"}</span>
                        <span className={cn("block truncate text-xs", estadoVerificacion(p) === "cambiaron" ? "text-amber-500" : "text-muted-foreground")}>
                          {estadoVerificacion(p) === "cambiaron" ? "Cambiaron después de verificar" : p.cliente || "—"}
                        </span>
                      </span>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 shrink-0 text-xs"
                        onClick={() => {
                          setAbierto(false);
                          setCostosDe(p.id);
                        }}
                      >
                        Revisar
                      </Button>
                    </li>
                  ))}
                </ul>
              </>
            ) : (
              <>
                <p className="mb-1 text-xs text-muted-foreground">
                  Eventos sin centro de costos. Escríbelo y dale Guardar.
                </p>
                <ul className="-mx-1 max-h-[60vh] divide-y divide-border overflow-y-auto">
                  {sinCentro.map((p) => (
                    <FilaCentro key={p.id} proyecto={p} onGuardar={(v) => updateProject(p.id, "centroCostos", v)} />
                  ))}
                </ul>
              </>
            )}
          </PopoverContent>
        </Popover>
      )}
      {elegido && (
        <CostosEventoDialog
          proyecto={elegido}
          open
          onOpenChange={(o) => !o && setCostosDe(null)}
          onGuardar={async (costos: CostoEvento[]) => {
            await updateProject(elegido.id, "costos", costos);
          }}
          onGuardarAdjuntos={async (archivos) => {
            await updateProject(elegido.id, "costosAdjuntos", archivos);
          }}
        />
      )}
    </>
  );
}

function FilaCentro({ proyecto, onGuardar }: { proyecto: Project; onGuardar: (v: string) => Promise<void> }) {
  const [valor, setValor] = useState("");
  const [guardando, setGuardando] = useState(false);
  const guardar = async () => {
    const v = valor.trim();
    if (!v) return;
    setGuardando(true);
    try {
      await onGuardar(v);
      const { data } = await supabase.from("projects").select("centro_costos").eq("id", proyecto.id).single();
      if ((data as { centro_costos?: string } | null)?.centro_costos !== v) throw new Error("La base no lo guardó.");
      toast({ title: "✓ Centro de costos guardado", description: `${proyecto.evento}: ${v}` });
    } catch (e) {
      toast({ title: "No se guardó", description: e instanceof Error ? e.message : "Intenta de nuevo", variant: "destructive" });
    } finally {
      setGuardando(false);
    }
  };
  return (
    <li className="flex items-center gap-2 px-1 py-2">
      <span className="w-14 shrink-0 text-xs tabular-nums text-muted-foreground">
        {fechaCorta(proyecto.fechaEjecucionInicio)}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm">{proyecto.evento || "Sin nombre"}</span>
        <span className="block truncate text-xs text-muted-foreground">{proyecto.cliente || "—"}</span>
      </span>
      <Input
        value={valor}
        onChange={(e) => setValor(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && guardar()}
        placeholder="Ej: 3-00814"
        className="h-7 w-24 font-mono text-xs"
      />
      <Button size="sm" className="h-7 shrink-0 text-xs" disabled={!valor.trim() || guardando} onClick={guardar}>
        {guardando ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Guardar"}
      </Button>
    </li>
  );
}
