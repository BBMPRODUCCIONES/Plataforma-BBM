import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, ClipboardList, Loader2, Lock, Pencil, Plus, Target, Trash2, Undo2 } from "lucide-react";
import Layout from "@/components/Layout";
import { PanelHeader } from "@/components/PanelHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useAuth } from "@/contexts/AuthContext";
import { useProjects } from "@/contexts/ProjectsContext";
import { useUsuariosRegistrados } from "@/hooks/useUsuariosRegistrados";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { COLORES_DE_COMERCIAL } from "@/lib/coloresProyecto";
import {
  avanceDeMeta,
  hoyBogota,
  NOMBRE_TAREA,
  Persona,
  puedeVerProductividad,
  responsabilidadesDe,
  resumir,
  Tarea,
  tareasAutomaticas,
  TipoTarea,
  vencida,
} from "@/lib/productividad";

/**
 * Productividad del equipo. Solo Bayron (lib/productividad).
 *
 *  - Supervision: lo que esta pendiente en todo el equipo (facturas, centros
 *    de costos, costos por cargar y por auditar).
 *  - Equipo: por persona, que le toca, cuanto hizo y si lo hizo a tiempo.
 *  - Ventas y metas: avance de cada comercial contra su meta del mes.
 *  - Tareas asignadas: las que Bayron crea a mano.
 */
interface TareaManual {
  id: string;
  titulo: string;
  descripcion: string;
  asignada_a: string | null;
  asignada_a_nombre: string;
  asignada_a_correo: string | null;
  fecha_limite: string | null;
  estado: "pendiente" | "hecha";
  creada_en: string;
  hecha_en: string | null;
}

const pesos = (n: number) =>
  new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(Math.round(n));
const mesActual = () => hoyBogota().slice(0, 7);
const nombreMes = (m: string) => {
  const [y, mm] = m.split("-").map(Number);
  return new Date(Date.UTC(y, mm - 1, 15)).toLocaleDateString("es-CO", { month: "long", year: "numeric", timeZone: "UTC" });
};
const mesesAtras = (n: number) => {
  const out: string[] = [];
  const [y, m] = mesActual().split("-").map(Number);
  for (let i = 0; i < n; i++) {
    const d = new Date(Date.UTC(y, m - 1 - i, 1));
    out.push(d.toISOString().slice(0, 7));
  }
  return out;
};
const fechaCorta = (d?: string | null) =>
  d ? new Date(`${d.slice(0, 10)}T12:00:00Z`).toLocaleDateString("es-CO", { day: "numeric", month: "short", timeZone: "UTC" }) : "—";
const diaDe = (iso?: string | null) =>
  iso ? new Intl.DateTimeFormat("en-CA", { timeZone: "America/Bogota" }).format(new Date(iso)) : null;
const claveDe = (correo?: string | null, nombre?: string) =>
  (correo || "").trim().toLowerCase() || (nombre || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, " ").trim();

export default function Productividad() {
  const { user } = useAuth();
  const permitido = puedeVerProductividad(user?.email);
  const { projects, loading } = useProjects();
  const { usuarios } = useUsuariosRegistrados();
  const [mes, setMes] = useState(mesActual());
  const [manuales, setManuales] = useState<TareaManual[]>([]);
  const [metas, setMetas] = useState<Record<string, number>>({});
  const [personaAbierta, setPersonaAbierta] = useState<string | null>(null);
  const [nuevaAbierta, setNuevaAbierta] = useState(false);
  const hoy = hoyBogota();

  const cargarManuales = useCallback(async () => {
    const { data, error } = await supabase
      .from("tareas" as never)
      .select("*")
      .order("creada_en", { ascending: false });
    if (!error) setManuales((data as unknown as TareaManual[]) || []);
  }, []);
  const cargarMetas = useCallback(async () => {
    const { data } = await supabase.from("metas_ventas" as never).select("comercial, meta_mensual");
    const m: Record<string, number> = {};
    for (const r of (data as unknown as { comercial: string; meta_mensual: number }[]) || []) m[r.comercial] = Number(r.meta_mensual);
    setMetas(m);
  }, []);

  useEffect(() => {
    if (!permitido) return;
    void cargarManuales();
    void cargarMetas();
  }, [permitido, cargarManuales, cargarMetas]);

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

  // Todas las tareas (automaticas + manuales), sin filtrar por mes.
  const todas: Tarea[] = useMemo(() => {
    const auto = tareasAutomaticas(projects, personas, hoy);
    const man: Tarea[] = manuales.map((t) => ({
      id: `manual-${t.id}`,
      manualId: t.id,
      tipo: "manual" as TipoTarea,
      titulo: t.titulo,
      detalle: t.descripcion,
      responsable: claveDe(t.asignada_a_correo, t.asignada_a_nombre),
      responsableNombre: t.asignada_a_nombre,
      fecha: t.fecha_limite || diaDe(t.creada_en) || hoy,
      limite: t.fecha_limite,
      hecha: t.estado === "hecha",
      hechaEl: diaDe(t.hecha_en),
    }));
    return [...auto, ...man];
  }, [projects, personas, manuales, hoy]);

  const delMes = useMemo(() => todas.filter((t) => t.fecha.slice(0, 7) === mes), [todas, mes]);
  const pendientesTodas = useMemo(() => todas.filter((t) => !t.hecha), [todas]);

  // Una fila por persona que tenga algo (en el mes o pendiente).
  const filas = useMemo(() => {
    const claves = new Map<string, string>();
    for (const t of [...delMes, ...pendientesTodas]) claves.set(t.responsable, t.responsableNombre);
    return [...claves.entries()]
      .map(([clave, nombre]) => {
        const r = resumir(delMes.filter((t) => t.responsable === clave), hoy);
        const pend = pendientesTodas.filter((t) => t.responsable === clave);
        return {
          clave,
          nombre,
          r,
          pendientes: pend.length,
          vencidas: pend.filter((t) => vencida(t, hoy)).length,
        };
      })
      .sort((a, b) => b.vencidas - a.vencidas || b.pendientes - a.pendientes || a.nombre.localeCompare(b.nombre));
  }, [delMes, pendientesTodas, hoy]);

  const supervision = useMemo(() => {
    const cuenta = (tipo: TipoTarea) => {
      const p = pendientesTodas.filter((t) => t.tipo === tipo);
      return { pendientes: p.length, vencidas: p.filter((t) => vencida(t, hoy)).length };
    };
    return [
      { tipo: "factura" as TipoTarea, ...cuenta("factura") },
      { tipo: "centro_costos" as TipoTarea, ...cuenta("centro_costos") },
      { tipo: "costos" as TipoTarea, ...cuenta("costos") },
      { tipo: "verificar_costos" as TipoTarea, ...cuenta("verificar_costos") },
      { tipo: "personal" as TipoTarea, ...cuenta("personal") },
      { tipo: "valor_cotizacion" as TipoTarea, ...cuenta("valor_cotizacion") },
    ];
  }, [pendientesTodas, hoy]);

  const [tipoAbierto, setTipoAbierto] = useState<TipoTarea | null>(null);

  if (!permitido) {
    return (
      <Layout>
        <div className="mx-auto max-w-md py-16 text-center">
          <Lock className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
          <p className="font-semibold">Este apartado es privado</p>
        </div>
      </Layout>
    );
  }

  const personaSel = filas.find((f) => f.clave === personaAbierta);
  const personaObj: Persona = personas.find((p) => p.clave === personaAbierta) || {
    clave: personaAbierta || "",
    nombre: personaSel?.nombre || "",
  };

  return (
    <Layout>
      <div className="space-y-4">
        <PanelHeader
          title="Productividad"
          description="Solo tú ves esta sección. Tareas de cada persona, cumplimiento y metas de ventas."
          actions={
            <div className="flex items-center gap-2">
              <Select value={mes} onValueChange={setMes}>
                <SelectTrigger className="h-9 w-44 text-xs capitalize"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {mesesAtras(6).map((m) => (
                    <SelectItem key={m} value={m} className="capitalize">{nombreMes(m)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button size="sm" className="h-9 gap-1" onClick={() => setNuevaAbierta(true)}>
                <Plus className="h-4 w-4" /> Tarea
              </Button>
            </div>
          }
        />

        {loading ? (
          <div className="flex items-center gap-2 p-6 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Cargando…</div>
        ) : (
          <Tabs defaultValue="supervision" className="space-y-4">
            <TabsList className="flex w-full flex-wrap sm:w-auto">
              <TabsTrigger value="supervision">Supervisión</TabsTrigger>
              <TabsTrigger value="equipo">Equipo</TabsTrigger>
              <TabsTrigger value="ventas">Ventas y metas</TabsTrigger>
              <TabsTrigger value="tareas">Tareas asignadas</TabsTrigger>
            </TabsList>

            {/* ---------------- Supervision ---------------- */}
            <TabsContent value="supervision" className="space-y-3">
              <p className="text-xs text-muted-foreground">
                Todo lo pendiente del equipo, sin importar el mes. Toca una tarjeta para ver la lista.
              </p>
              <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
                {supervision.map((s) => (
                  <button
                    key={s.tipo}
                    type="button"
                    onClick={() => setTipoAbierto(s.tipo)}
                    className={cn(
                      "rounded-lg border p-3 text-left transition-colors hover:bg-muted/40",
                      s.vencidas > 0 && "border-destructive/50"
                    )}
                  >
                    <div className="text-xs text-muted-foreground">{NOMBRE_TAREA[s.tipo]}</div>
                    <div className="mt-1 text-2xl font-bold tabular-nums">{s.pendientes}</div>
                    <div className={cn("text-xs", s.vencidas ? "text-destructive" : "text-muted-foreground")}>
                      {s.vencidas ? `${s.vencidas} vencida${s.vencidas === 1 ? "" : "s"}` : "al día"}
                    </div>
                  </button>
                ))}
              </div>
              <ResumenVentas projects={projects} metas={metas} mes={mes} compacto />
            </TabsContent>

            {/* ---------------- Equipo ---------------- */}
            <TabsContent value="equipo">
              <div className="overflow-x-auto rounded-lg border">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 text-left text-xs">
                    <tr>
                      <th className="px-3 py-2 font-medium">Persona</th>
                      <th className="px-3 py-2 text-right font-medium">Tareas del mes</th>
                      <th className="px-3 py-2 text-right font-medium">Cumplidas</th>
                      <th className="px-3 py-2 text-right font-medium">A tiempo</th>
                      <th className="px-3 py-2 text-right font-medium">Retraso prom.</th>
                      <th className="px-3 py-2 text-right font-medium">Pendientes</th>
                      <th className="px-3 py-2 text-right font-medium">Vencidas</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {filas.map((f) => (
                      <tr key={f.clave} className="cursor-pointer hover:bg-muted/30" onClick={() => setPersonaAbierta(f.clave)}>
                        <td className="px-3 py-2 font-medium">{f.nombre}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{f.r.total}</td>
                        <td className="px-3 py-2 text-right tabular-nums">
                          {f.r.total ? `${Math.round((f.r.hechas / f.r.total) * 100)}%` : "—"}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums">
                          {f.r.medibles ? `${Math.round((f.r.aTiempo / f.r.medibles) * 100)}%` : "—"}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums">{f.r.demoraPromedio != null ? `${f.r.demoraPromedio} d` : "—"}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{f.pendientes}</td>
                        <td className={cn("px-3 py-2 text-right tabular-nums", f.vencidas && "font-semibold text-destructive")}>{f.vencidas}</td>
                      </tr>
                    ))}
                    {filas.length === 0 && (
                      <tr><td colSpan={7} className="p-6 text-center text-muted-foreground">No hay tareas en este mes.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
              <p className="mt-2 text-[11px] text-muted-foreground">
                Cumplidas = hechas ÷ tareas del mes. A tiempo = hechas antes de su fecha límite (solo las que tienen fecha
                registrada). Retraso prom. = días de más en las que se hicieron tarde. Pendientes y vencidas cuentan todo lo
                que falta, de cualquier mes.
              </p>
            </TabsContent>

            {/* ---------------- Ventas ---------------- */}
            <TabsContent value="ventas">
              <ResumenVentas projects={projects} metas={metas} mes={mes} onMetaGuardada={cargarMetas} />
            </TabsContent>

            {/* ---------------- Tareas manuales ---------------- */}
            <TabsContent value="tareas">
              <ListaManuales tareas={manuales} hoy={hoy} onCambio={cargarManuales} onNueva={() => setNuevaAbierta(true)} />
            </TabsContent>
          </Tabs>
        )}
      </div>

      {/* Ficha de la persona */}
      <Sheet open={Boolean(personaAbierta)} onOpenChange={(o) => !o && setPersonaAbierta(null)}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
          <SheetHeader>
            <SheetTitle>{personaSel?.nombre}</SheetTitle>
          </SheetHeader>
          {personaSel && (
            <div className="mt-4 space-y-4 text-sm">
              <div>
                <p className="mb-1 text-xs font-semibold uppercase text-muted-foreground">Qué le toca en el planner</p>
                <ul className="list-disc space-y-1 pl-5">
                  {responsabilidadesDe(personaObj, todas).map((r, i) => <li key={i}>{r}</li>)}
                </ul>
              </div>
              <ListaTareas
                titulo="Pendientes"
                tareas={pendientesTodas.filter((t) => t.responsable === personaSel.clave)}
                hoy={hoy}
              />
              <ListaTareas
                titulo={`Hechas en ${nombreMes(mes)}`}
                tareas={delMes.filter((t) => t.responsable === personaSel.clave && t.hecha)}
                hoy={hoy}
              />
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* Lista por tipo (desde Supervision) */}
      <Sheet open={Boolean(tipoAbierto)} onOpenChange={(o) => !o && setTipoAbierto(null)}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
          <SheetHeader>
            <SheetTitle>{tipoAbierto ? NOMBRE_TAREA[tipoAbierto] : ""} · pendientes</SheetTitle>
          </SheetHeader>
          <div className="mt-4">
            <ListaTareas titulo="" tareas={pendientesTodas.filter((t) => t.tipo === tipoAbierto)} hoy={hoy} conResponsable />
          </div>
        </SheetContent>
      </Sheet>

      <NuevaTarea
        abierto={nuevaAbierta}
        onCerrar={() => setNuevaAbierta(false)}
        personas={usuarios.filter((u) => u.correo)}
        onCreada={cargarManuales}
        creador={user?.email || ""}
      />
    </Layout>
  );
}

function ListaTareas({ titulo, tareas, hoy, conResponsable }: { titulo: string; tareas: Tarea[]; hoy: string; conResponsable?: boolean }) {
  const orden = [...tareas].sort((a, b) => {
    const va = vencida(a, hoy) ? 0 : 1;
    const vb = vencida(b, hoy) ? 0 : 1;
    return va - vb || (a.limite || "9").localeCompare(b.limite || "9");
  });
  return (
    <div>
      {titulo && <p className="mb-1 text-xs font-semibold uppercase text-muted-foreground">{titulo} ({tareas.length})</p>}
      {orden.length === 0 ? (
        <p className="text-xs text-muted-foreground">Nada por aquí.</p>
      ) : (
        <ul className="divide-y rounded-md border">
          {orden.map((t) => {
            const v = vencida(t, hoy);
            const tarde = t.hecha && t.hechaEl && t.limite && t.hechaEl > t.limite;
            return (
              <li key={t.id} className="flex items-start gap-2 px-3 py-2">
                {t.hecha ? (
                  <CheckCircle2 className={cn("mt-0.5 h-4 w-4 shrink-0", tarde ? "text-amber-500" : "text-emerald-500")} />
                ) : v ? (
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
                ) : (
                  <ClipboardList className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                )}
                <div className="min-w-0 flex-1">
                  <p className="text-sm">{t.titulo}</p>
                  {t.detalle && <p className="truncate text-xs text-muted-foreground">{t.detalle}</p>}
                  {conResponsable && <p className="text-xs text-muted-foreground">Responsable: {t.responsableNombre}</p>}
                </div>
                <div className="shrink-0 text-right text-xs">
                  <div className={cn(v && "font-semibold text-destructive")}>{t.limite ? `Límite ${fechaCorta(t.limite)}` : "Sin límite"}</div>
                  {t.hecha && (
                    <div className={cn(tarde ? "text-amber-500" : "text-emerald-500")}>
                      {t.hechaEl ? `Hecha ${fechaCorta(t.hechaEl)}` : "Hecha"}
                    </div>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function ResumenVentas({
  projects,
  metas,
  mes,
  compacto,
  onMetaGuardada,
}: {
  projects: ReturnType<typeof useProjects>["projects"];
  metas: Record<string, number>;
  mes: string;
  compacto?: boolean;
  onMetaGuardada?: () => void;
}) {
  const [editando, setEditando] = useState<string | null>(null);
  const [valor, setValor] = useState("");
  const comerciales = COLORES_DE_COMERCIAL.map((c) => c.comercial as string).filter(
    (c) => !compacto || metas[c] != null
  );

  const guardarMeta = async (comercial: string) => {
    const n = Number(valor.replace(/[^\d]/g, ""));
    const { error } = await supabase
      .from("metas_ventas" as never)
      .upsert({ comercial, meta_mensual: n, actualizada_en: new Date().toISOString() } as never);
    if (error) toast({ title: "No se guardó la meta", description: error.message, variant: "destructive" });
    else {
      toast({ title: "Meta guardada", description: `${comercial}: ${pesos(n)} al mes` });
      setEditando(null);
      onMetaGuardada?.();
    }
  };

  return (
    <div className={cn("grid gap-3", !compacto && "md:grid-cols-2")}>
      {comerciales.map((c) => {
        const meta = metas[c] ?? 0;
        const a = avanceDeMeta(projects, c, meta, mes);
        const pct = meta > 0 ? (a.vendido / meta) * 100 : null;
        const pctEj = meta > 0 ? (a.ejecutadoAFecha / meta) * 100 : 0;
        const maxSemana = Math.max(1, ...a.porSemana.map((s) => s.venta));
        return (
          <Card key={c}>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm">
                <Target className="h-4 w-4" /> Ventas de {c} · <span className="capitalize">{nombreMes(mes)}</span>
                {!compacto && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="ml-auto h-7 gap-1 text-xs"
                    onClick={() => {
                      setEditando(c);
                      setValor(meta ? String(meta) : "");
                    }}
                  >
                    <Pencil className="h-3 w-3" /> Meta
                  </Button>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              {editando === c && (
                <div className="flex gap-2">
                  <Input value={valor} onChange={(e) => setValor(e.target.value)} placeholder="Meta mensual sin IVA" inputMode="numeric" className="h-8" />
                  <Button size="sm" className="h-8" onClick={() => guardarMeta(c)}>Guardar</Button>
                </div>
              )}
              <div className="flex flex-wrap items-end justify-between gap-2">
                <div>
                  <div className="text-2xl font-bold tabular-nums">{pesos(a.vendido)}</div>
                  <div className="text-xs text-muted-foreground">
                    {meta ? `de ${pesos(meta)} · ${pct!.toFixed(0)}% de la meta` : "Sin meta definida"} · {a.eventos} evento(s)
                  </div>
                </div>
              </div>
              {meta > 0 && (
                <div className="relative h-2.5 overflow-hidden rounded-full bg-muted">
                  <div className="absolute inset-y-0 left-0 bg-blue-500/40" style={{ width: `${Math.min(100, pct!)}%` }} />
                  <div className="absolute inset-y-0 left-0 bg-blue-500" style={{ width: `${Math.min(100, pctEj)}%` }} />
                </div>
              )}
              <div className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
                <Dato k="Ejecutado a hoy" v={pesos(a.ejecutadoAFecha)} />
                <Dato k="Promedio diario" v={pesos(a.promedioDiario)} />
                <Dato k="Promedio semanal" v={pesos(a.promedioSemanal)} />
                <Dato k="Proyección del mes" v={pesos(a.proyeccion)} alerta={meta > 0 && a.proyeccion < meta} />
              </div>
              {meta > 0 && a.necesarioPorDia != null && (
                <p className="text-xs text-muted-foreground">
                  Para llegar a la meta necesita {pesos(a.necesarioPorDia)} por día en los {a.diasMes - a.diasTranscurridos} días que quedan.
                </p>
              )}
              {!compacto && (
                <div>
                  <p className="mb-1 text-xs text-muted-foreground">Por semana del mes</p>
                  <div className="space-y-1">
                    {a.porSemana.map((s) => (
                      <div key={s.semana} className="flex items-center gap-2 text-xs">
                        <span className="w-14 shrink-0 tabular-nums text-muted-foreground">{s.semana}</span>
                        <div className="h-3 flex-1 rounded bg-muted">
                          <div className="h-3 rounded bg-blue-500" style={{ width: `${(s.venta / maxSemana) * 100}%` }} />
                        </div>
                        <span className="w-28 shrink-0 text-right tabular-nums">{pesos(s.venta)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}
      {!compacto && (
        <p className="text-[11px] text-muted-foreground md:col-span-2">
          Venta = valor sin IVA de los eventos del comercial (por su color o por quien los creó), por fecha de ejecución,
          igual que en el dashboard. La barra clara es todo lo del mes; la oscura, lo ya ejecutado. Promedios = ejecutado a
          hoy ÷ días corridos del mes (semanal = diario × 7).
        </p>
      )}
    </div>
  );
}

function Dato({ k, v, alerta }: { k: string; v: string; alerta?: boolean }) {
  return (
    <div className="rounded-md bg-muted/40 p-2">
      <div className="text-[10px] uppercase text-muted-foreground">{k}</div>
      <div className={cn("font-semibold tabular-nums", alerta && "text-amber-500")}>{v}</div>
    </div>
  );
}

function ListaManuales({
  tareas,
  hoy,
  onCambio,
  onNueva,
}: {
  tareas: TareaManual[];
  hoy: string;
  onCambio: () => void;
  onNueva: () => void;
}) {
  const cambiarEstado = async (t: TareaManual) => {
    const { error } = await supabase
      .from("tareas" as never)
      .update({ estado: t.estado === "hecha" ? "pendiente" : "hecha" } as never)
      .eq("id", t.id);
    if (error) toast({ title: "No se pudo cambiar", description: error.message, variant: "destructive" });
    onCambio();
  };
  const borrar = async (t: TareaManual) => {
    if (!window.confirm(`¿Borrar la tarea "${t.titulo}"?`)) return;
    await supabase.from("tareas" as never).delete().eq("id", t.id);
    onCambio();
  };
  if (tareas.length === 0) {
    return (
      <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
        Todavía no has asignado tareas.{" "}
        <Button size="sm" variant="link" onClick={onNueva}>Crear la primera</Button>
      </div>
    );
  }
  return (
    <ul className="divide-y rounded-lg border">
      {tareas.map((t) => {
        const v = t.estado === "pendiente" && t.fecha_limite && t.fecha_limite < hoy;
        return (
          <li key={t.id} className="flex items-start gap-3 px-3 py-2 text-sm">
            <div className="min-w-0 flex-1">
              <p className={cn("font-medium", t.estado === "hecha" && "text-muted-foreground line-through")}>{t.titulo}</p>
              {t.descripcion && <p className="text-xs text-muted-foreground">{t.descripcion}</p>}
              <p className="text-xs text-muted-foreground">
                {t.asignada_a_nombre} · {t.fecha_limite ? `límite ${fechaCorta(t.fecha_limite)}` : "sin límite"}
                {t.hecha_en && ` · hecha ${fechaCorta(diaDe(t.hecha_en))}`}
              </p>
            </div>
            {v && <span className="shrink-0 text-xs font-semibold text-destructive">Vencida</span>}
            <Button size="sm" variant="ghost" className="h-7 gap-1 text-xs" onClick={() => cambiarEstado(t)}>
              {t.estado === "hecha" ? <><Undo2 className="h-3 w-3" /> Reabrir</> : <><CheckCircle2 className="h-3 w-3" /> Hecha</>}
            </Button>
            <Button size="sm" variant="ghost" className="h-7 text-destructive" onClick={() => borrar(t)}>
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </li>
        );
      })}
    </ul>
  );
}

function NuevaTarea({
  abierto,
  onCerrar,
  personas,
  onCreada,
  creador,
}: {
  abierto: boolean;
  onCerrar: () => void;
  personas: { id: string; nombre: string; correo?: string }[];
  onCreada: () => void;
  creador: string;
}) {
  const [quien, setQuien] = useState("");
  const [titulo, setTitulo] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [limite, setLimite] = useState("");
  const [guardando, setGuardando] = useState(false);

  const crear = async () => {
    const p = personas.find((x) => x.id === quien);
    if (!p) return toast({ title: "Escoge a quién se le asigna", variant: "destructive" });
    if (!titulo.trim()) return toast({ title: "Escribe la tarea", variant: "destructive" });
    setGuardando(true);
    const { error } = await supabase.from("tareas" as never).insert({
      titulo: titulo.trim(),
      descripcion: descripcion.trim(),
      asignada_a: p.id,
      asignada_a_nombre: p.nombre,
      asignada_a_correo: p.correo?.toLowerCase() || null,
      fecha_limite: limite || null,
      creada_por: creador,
    } as never);
    setGuardando(false);
    if (error) return toast({ title: "No se creó la tarea", description: error.message, variant: "destructive" });
    toast({ title: "Tarea asignada", description: `${p.nombre}: ${titulo.trim()}` });
    setQuien("");
    setTitulo("");
    setDescripcion("");
    setLimite("");
    onCreada();
    onCerrar();
  };

  return (
    <Dialog open={abierto} onOpenChange={(o) => !o && onCerrar()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Asignar tarea</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label className="text-xs">Persona</Label>
            <Select value={quien} onValueChange={setQuien}>
              <SelectTrigger className="h-9"><SelectValue placeholder="Escoge a quién" /></SelectTrigger>
              <SelectContent>
                {personas.map((p) => <SelectItem key={p.id} value={p.id}>{p.nombre}</SelectItem>)}
              </SelectContent>
            </Select>
            <p className="text-[11px] text-muted-foreground">Solo salen quienes tienen cuenta: la verán en su planner para marcarla como hecha.</p>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Tarea</Label>
            <Input value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Ej: actualizar inventario de pantallas" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Detalle (opcional)</Label>
            <Textarea value={descripcion} onChange={(e) => setDescripcion(e.target.value)} rows={3} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Fecha límite</Label>
            <Input type="date" value={limite} onChange={(e) => setLimite(e.target.value)} className="h-9 w-44" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onCerrar}>Cancelar</Button>
          <Button onClick={crear} disabled={guardando}>
            {guardando && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Asignar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
