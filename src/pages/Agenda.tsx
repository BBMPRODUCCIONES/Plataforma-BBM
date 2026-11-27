import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2, User, Users } from "lucide-react";
import Layout from "@/components/Layout";
import { EventCalendar } from "@/components/EventCalendar";
import { MisPendientesDirectivo } from "@/components/MisPendientesDirectivo";
import { useProjects } from "@/contexts/ProjectsContext";
import { useAuth } from "@/contexts/AuthContext";
import { useUserRole } from "@/hooks/useUserRole";
import { useUsuariosRegistrados } from "@/hooks/useUsuariosRegistrados";
import { esSuProyecto } from "@/lib/alertaCostos";
import { cn } from "@/lib/utils";

/**
 * Agenda: la pantalla de inicio en el celular.
 *
 * En el celular las tablas de los paneles no se leen bien. Aqui lo primero es
 * el calendario: se toca un dia, salen los eventos de ese dia con hora, lugar
 * y productor, y al tocar uno se abre su ficha. Desde la ficha se va al
 * evento en el Panel General para editarlo. Arriba quedan "Mis pendientes".
 */
export default function Agenda() {
  const navigate = useNavigate();
  const { projects, loading } = useProjects();
  const { user } = useAuth();
  const { role, canEditDirectivo } = useUserRole();
  const { usuarios } = useUsuariosRegistrados();
  const [soloMios, setSoloMios] = useState(false);
  const hoy = useMemo(() => new Date(), []);

  const nombre = usuarios.find((u) => u.id === user?.id)?.nombre ?? null;
  const visibles = useMemo(() => {
    const vivos = projects.filter((p) => !p.isDeleted);
    return soloMios ? vivos.filter((p) => esSuProyecto(p, nombre, user?.email)) : vivos;
  }, [projects, soloMios, nombre, user?.email]);

  const esAdmin = role?.toLowerCase() === "administrador";

  return (
    <Layout>
      <div className="mx-auto max-w-3xl space-y-3 px-3 pb-6 pt-2">
        <div className="flex items-center justify-between gap-2">
          <h1 className="text-lg font-bold">Agenda</h1>
          <div className="flex rounded-lg bg-muted p-0.5 text-sm">
            <button
              type="button"
              onClick={() => setSoloMios(false)}
              className={cn(
                "flex items-center gap-1.5 rounded-md px-3 py-1.5",
                !soloMios ? "bg-card font-semibold shadow-sm" : "text-muted-foreground"
              )}
            >
              <Users className="h-4 w-4" /> Todos
            </button>
            <button
              type="button"
              onClick={() => setSoloMios(true)}
              className={cn(
                "flex items-center gap-1.5 rounded-md px-3 py-1.5",
                soloMios ? "bg-card font-semibold shadow-sm" : "text-muted-foreground"
              )}
            >
              <User className="h-4 w-4" /> Míos
            </button>
          </div>
        </div>

        <MisPendientesDirectivo />

        <div className="rounded-xl border border-border bg-card p-2.5">
          {loading ? (
            <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Cargando eventos…
            </div>
          ) : (
            <EventCalendar
              projects={visibles}
              diaInicial={hoy}
              mostrarDinero={esAdmin && canEditDirectivo()}
              onProjectClick={(id) => navigate(`/panel-general?eventId=${id}`)}
            />
          )}
        </div>
        <p className="px-1 text-center text-xs text-muted-foreground">
          Toca un día para ver sus eventos y un evento para abrir su ficha.
        </p>
      </div>
    </Layout>
  );
}
