import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, Bell, ChevronDown, ChevronUp, ClipboardList, X } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { useProjects } from "@/contexts/ProjectsContext";
import { useUsuariosRegistrados } from "@/hooks/useUsuariosRegistrados";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import {
  hoyBogota,
  NOMBRE_TAREA,
  Persona,
  Tarea,
  tareasAutomaticas,
  vencida,
} from "@/lib/productividad";

/**
 * "Mis pendientes" en el Panel Directivo: las tareas de Productividad que le
 * tocan a quien esta mirando (como productor o como comercial) y siguen sin
 * hacer, mas las tareas que Bayron le asigno a mano.
 *
 * Solo para los directivos. Las tareas se calculan igual que en
 * Productividad, asi que lo que ve aqui es lo mismo que mide ese apartado.
 */
export const DIRECTIVOS_CON_PENDIENTES = [
  "abraham.varela@bbmproducciones.com.co",
  "bayron.bocanegra@bbmproducciones.com.co",
];

const claveDe = (correo?: string | null, nombre?: string) =>
  (correo || "").trim().toLowerCase() ||
  (nombre || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, " ").trim();

const fechaCorta = (d?: string | null) =>
  d
    ? new Date(`${d.slice(0, 10)}T12:00:00Z`).toLocaleDateString("es-CO", { day: "numeric", month: "short", timeZone: "UTC" })
    : "Sin fecha";

interface TareaManual {
  id: string;
  titulo: string;
  descripcion: string;
  fecha_limite: string | null;
  creada_en: string;
}

/** Las tareas pendientes de quien esta mirando, si es directivo. */
export function useMisPendientes() {
  const { user } = useAuth();
  const { projects } = useProjects();
  const { usuarios } = useUsuariosRegistrados();
  const [manuales, setManuales] = useState<TareaManual[]>([]);
  const correo = (user?.email || "").toLowerCase();
  const permitido = DIRECTIVOS_CON_PENDIENTES.includes(correo);
  const hoy = hoyBogota();

  const cargarManuales = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from("tareas" as never)
      .select("id, titulo, descripcion, fecha_limite, creada_en")
      .eq("asignada_a", user.id)
      .eq("estado", "pendiente");
    setManuales((data as unknown as TareaManual[]) || []);
  }, [user]);

  useEffect(() => {
    if (permitido) void cargarManuales();
  }, [permitido, cargarManuales]);

  const personas: Persona[] = useMemo(
    () =>
      usuarios.map((u) => ({
        clave: claveDe(u.correo, u.nombre),
        nombre: u.nombre,
        correo: u.correo ? u.correo.toLowerCase() : undefined,
        usuarioId: u.correo ? u.id : undefined,
      })),
    [usuarios]
  );

  const pendientes: Tarea[] = useMemo(() => {
    if (!permitido || personas.length === 0) return [];
    const mias = tareasAutomaticas(projects, personas, hoy).filter((t) => !t.hecha && t.responsable === correo);
    const man: Tarea[] = manuales.map((t) => ({
      id: `manual-${t.id}`,
      manualId: t.id,
      tipo: "manual",
      titulo: t.titulo,
      detalle: t.descripcion,
      responsable: correo,
      responsableNombre: "",
      fecha: t.fecha_limite || t.creada_en.slice(0, 10),
      limite: t.fecha_limite,
      hecha: false,
      hechaEl: null,
    }));
    return [...mias, ...man].sort((a, b) => (a.limite || "9999").localeCompare(b.limite || "9999"));
  }, [permitido, personas, projects, manuales, correo, hoy]);

  return { permitido, pendientes, hoy };
}

export function MisPendientesDirectivo({ onAbrirEvento }: { onAbrirEvento?: (id: string) => void }) {
  const { permitido, pendientes, hoy } = useMisPendientes();
  const [abierto, setAbierto] = useState(true);
  if (!permitido) return null;

  const vencidas = pendientes.filter((t) => vencida(t, hoy)).length;

  return (
    <div className="panel-card rounded-xl border border-border bg-card">
      <button
        type="button"
        onClick={() => setAbierto((v) => !v)}
        className="flex w-full items-center gap-2 px-4 py-3 text-left"
      >
        <ClipboardList className="h-4 w-4 shrink-0" />
        <span className="flex-1 text-sm font-semibold">
          Mis pendientes
          <span className="ml-2 font-normal text-muted-foreground">
            {pendientes.length === 0
              ? "· Todo al día"
              : `· ${pendientes.length} tarea${pendientes.length === 1 ? "" : "s"}`}
          </span>
          {vencidas > 0 && (
            <span className="ml-2 inline-flex items-center gap-1 rounded-md bg-destructive/10 px-1.5 py-0.5 text-xs font-medium text-destructive">
              <AlertTriangle className="h-3 w-3" />
              {vencidas} vencida{vencidas === 1 ? "" : "s"}
            </span>
          )}
        </span>
        {pendientes.length > 0 &&
          (abierto ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />)}
      </button>

      {abierto && pendientes.length > 0 && (
        <ul className="max-h-80 divide-y divide-border overflow-y-auto border-t border-border">
          {pendientes.map((t) => {
            const tarde = vencida(t, hoy);
            const clic = t.proyectoId && onAbrirEvento ? () => onAbrirEvento(t.proyectoId!) : undefined;
            return (
              <li
                key={t.id}
                onClick={clic}
                className={cn(
                  "flex items-center gap-3 px-4 py-2 text-sm",
                  clic && "cursor-pointer hover:bg-muted/40",
                  tarde && "bg-destructive/5"
                )}
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">
                    {t.titulo || NOMBRE_TAREA[t.tipo]}
                  </span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {t.detalle || (t.tipo === "manual" ? "Tarea asignada" : "")}
                  </span>
                </span>
                <span
                  className={cn(
                    "shrink-0 text-xs tabular-nums",
                    tarde ? "font-semibold text-destructive" : "text-muted-foreground"
                  )}
                >
                  {tarde ? "Venció " : "Hasta "}
                  {fechaCorta(t.limite)}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

/**
 * Aviso al entrar al planner, como una notificacion de redes sociales: cuantas
 * tareas tiene pendientes y cuales. Sale una vez por sesion del navegador;
 * se cierra con la X o con "Ver todas", que lleva al Panel Directivo.
 */
const CLAVE_AVISO = "bbm-aviso-pendientes-visto";

export function AvisoPendientesAlEntrar() {
  const { permitido, pendientes, hoy } = useMisPendientes();
  const navigate = useNavigate();
  const [visto, setVisto] = useState(() => {
    try {
      return sessionStorage.getItem(CLAVE_AVISO) === "1";
    } catch {
      return false;
    }
  });
  const [listo, setListo] = useState(false);

  // Espera un momento a que carguen eventos y usuarios, para no avisar "0".
  useEffect(() => {
    if (!permitido || visto) return;
    const t = setTimeout(() => setListo(true), 2500);
    return () => clearTimeout(t);
  }, [permitido, visto]);

  if (!permitido || visto || !listo || pendientes.length === 0) return null;

  const cerrar = () => {
    try {
      sessionStorage.setItem(CLAVE_AVISO, "1");
    } catch {
      /* sin almacenamiento: se vuelve a mostrar al recargar */
    }
    setVisto(true);
  };
  const vencidas = pendientes.filter((t) => vencida(t, hoy)).length;
  const primeras = pendientes.slice(0, 5);

  return (
    <div
      role="status"
      className="fixed right-3 top-3 z-[60] w-[min(92vw,22rem)] animate-in slide-in-from-top-4 fade-in-0 rounded-2xl border border-border bg-card p-3 shadow-2xl duration-300"
    >
      <div className="flex items-start gap-3">
        <span className="relative mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
          <Bell className="h-4 w-4" />
          <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive px-1 text-[11px] font-bold text-white">
            {pendientes.length}
          </span>
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">
            Tienes {pendientes.length} tarea{pendientes.length === 1 ? "" : "s"} pendiente{pendientes.length === 1 ? "" : "s"}
          </p>
          {vencidas > 0 && (
            <p className="text-xs font-medium text-destructive">
              {vencidas} vencida{vencidas === 1 ? "" : "s"}
            </p>
          )}
        </div>
        <button type="button" onClick={cerrar} className="rounded-md p-1 text-muted-foreground hover:bg-muted" aria-label="Cerrar aviso">
          <X className="h-4 w-4" />
        </button>
      </div>
      <ul className="mt-2 space-y-1">
        {primeras.map((t) => {
          const tarde = vencida(t, hoy);
          return (
            <li key={t.id} className={cn("rounded-lg px-2 py-1.5 text-xs", tarde ? "bg-destructive/10" : "bg-muted/50")}>
              <span className="block truncate font-medium">{t.titulo || NOMBRE_TAREA[t.tipo]}</span>
              <span className="flex justify-between gap-2 text-muted-foreground">
                <span className="truncate">{t.detalle || ""}</span>
                <span className={cn("shrink-0 tabular-nums", tarde && "font-semibold text-destructive")}>
                  {tarde ? "Venció " : "Hasta "}
                  {fechaCorta(t.limite)}
                </span>
              </span>
            </li>
          );
        })}
      </ul>
      {pendientes.length > primeras.length && (
        <p className="mt-1 text-center text-[11px] text-muted-foreground">y {pendientes.length - primeras.length} más</p>
      )}
      <Button
        size="sm"
        className="mt-2 h-8 w-full text-xs"
        onClick={() => {
          cerrar();
          navigate("/panel-directivo");
        }}
      >
        Ver todas en el Panel Directivo
      </Button>
    </div>
  );
}
