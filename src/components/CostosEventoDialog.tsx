import { useEffect, useMemo, useRef, useState } from "react";
import { Plus, Trash2, Loader2, Receipt, ShieldCheck, AlertTriangle, Lock } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { EmpleadoAutocomplete } from "@/components/EmpleadoAutocomplete";
import { ProveedorAutocomplete } from "@/components/ProveedorAutocomplete";
import { Attachment, CostoEvento, Project, TipoCosto } from "@/types";
import { AttachmentManager } from "@/components/AttachmentManager";
import { toast } from "@/hooks/use-toast";
import { ListaAdjuntos } from "@/components/ListaAdjuntos";
import { Checkbox } from "@/components/ui/checkbox";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { puedeVerificarCostos } from "@/lib/permisosCostos";
import { useProjects } from "@/contexts/ProjectsContext";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  huellaDeLinea,
  lineaCambioTrasVerificar,
  lineaDeMarca,
  lineasReales,
  lineaVerificada,
  TIPO_SIN_TERCEROS,
  marcadoSinTerceros,
} from "@/lib/costosEvento";

interface CostosEventoDialogProps {
  proyecto: Project | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onGuardar: (costos: CostoEvento[]) => Promise<void>;
  /** Guarda los archivos que respaldan los costos. */
  onGuardarAdjuntos: (archivos: Attachment[]) => Promise<void>;
  /** Sin permiso de editar Directivo se puede mirar, no tocar. */
  soloLectura?: boolean;
}

const TIPOS: { valor: TipoCosto; nombre: string }[] = [
  { valor: "personal", nombre: "Personal" },
  { valor: "proveedor", nombre: "Proveedor" },
  { valor: "transporte", nombre: "Transporte" },
  { valor: "alquiler", nombre: "Alquiler de equipos" },
  { valor: "produccion", nombre: "Producción" },
  { valor: "alimentacion", nombre: "Alimentación" },
  { valor: "otro", nombre: "Otro" },
];

const pesos = new Intl.NumberFormat("es-CO", {
  style: "currency",
  currency: "COP",
  maximumFractionDigits: 0,
});

const nombreDeTipo = (t: TipoCosto) => TIPOS.find((x) => x.valor === t)?.nombre ?? t;

function lineaNueva(): CostoEvento {
  return {
    id: `costo-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    tipo: "proveedor",
    concepto: "",
    beneficiario: "",
    valor: 0,
    creadoEn: new Date().toISOString(),
  };
}

/**
 * Costos reales del evento: a quien se le pago y cuanto.
 *
 * Es el otro lado del Ingreso Total, que hasta ahora estaba solo: se sabia lo
 * que entraba y no lo que salia, asi que la utilidad habia que sacarla aparte.
 */
export function CostosEventoDialog({
  proyecto,
  open,
  onOpenChange,
  onGuardar,
  onGuardarAdjuntos,
  soloLectura: soloLecturaProp = false,
}: CostosEventoDialogProps) {
  const [lineas, setLineas] = useState<CostoEvento[]>([]);
  const [sinTerceros, setSinTerceros] = useState(false);
  const [guardando, setGuardando] = useState(false);
  // La linea de marca "sin costos de terceros" que habia guardada: se conserva
  // (con su check) en vez de crear una nueva en cada guardado.
  const [marca, setMarca] = useState<CostoEvento | null>(null);
  const { user } = useAuth();
  const { updateProjectMultiple } = useProjects();
  const puedeVerificar = puedeVerificarCostos(user?.email);
  // Cierre de costos: cuando auxbbm@ termina el checklist (todas las lineas
  // con check) los costos quedan cerrados. Desde ahi nadie mas los puede
  // tocar; la base tambien lo impide. Solo quien verifica puede reabrirlos.
  const cierre = proyecto?.costosVerificacion?.en ? proyecto.costosVerificacion : null;
  const bloqueado = Boolean(cierre) && !puedeVerificar;
  const soloLectura = soloLecturaProp || bloqueado;
  const [reabriendo, setReabriendo] = useState(false);

  const [confirmarSalida, setConfirmarSalida] = useState(false);
  // Lo que habia guardado al abrir, para saber si hay cambios sin guardar.
  const [inicial, setInicial] = useState("");
  const abiertoPara = useRef<string | null>(null);

  // Cada apertura parte de lo que hay guardado, no de lo que quedo en pantalla
  // la vez anterior. La marca de "sin costos de terceros" vive dentro del
  // mismo campo, asi que se separa aqui y no se dibuja como una linea.
  //
  // OJO: se carga UNA vez por apertura (o si cambia el evento), no cada vez
  // que cambia el objeto `proyecto`. Antes dependia de `proyecto`, y como la
  // lista de eventos se refresca sola (otro usuario edita algo, o aqui mismo
  // se sube un soporte, que guarda el evento), el formulario se reiniciaba a
  // mitad de camino y se borraban las lineas que la persona venia escribiendo.
  // Despues daba "Guardar" y no quedaba nada: de ahi los "a veces no se guarda".
  useEffect(() => {
    if (!open) {
      abiertoPara.current = null;
      return;
    }
    const id = proyecto?.id ?? null;
    if (abiertoPara.current === id) return;
    abiertoPara.current = id;
    const l = lineasReales(proyecto?.costos);
    const st = marcadoSinTerceros(proyecto?.costos);
    const m = (proyecto?.costos || []).find((c) => c.tipo === (TIPO_SIN_TERCEROS as CostoEvento["tipo"])) ?? null;
    setLineas(l);
    setSinTerceros(st);
    setMarca(m);
    setInicial(JSON.stringify({ l, st, m: m?.verificacion ?? null }));
  }, [open, proyecto]);

  const hayCambios =
    !soloLectura && open && inicial !== "" &&
    JSON.stringify({ l: lineas, st: sinTerceros, m: marca?.verificacion ?? null }) !== inicial;

  // Cerrar con cambios sin guardar pide confirmacion en vez de perderlos.
  const pedirCierre = (abrir: boolean) => {
    if (!abrir && hayCambios && !guardando) {
      setConfirmarSalida(true);
      return;
    }
    onOpenChange(abrir);
  };

  /**
   * Guarda y COMPRUEBA en la base que quedo guardado.
   *
   * La funcion que guarda (updateProject del panel) no avisa si falla: muestra
   * un aviso suelto y sigue. Por eso aqui se vuelve a leer el evento desde la
   * base y se compara linea por linea. Solo si coincide se cierra la ventana y
   * se confirma; si no, la ventana sigue abierta con lo escrito.
   */
  const guardarYComprobar = async (lista: CostoEvento[]) => {
    if (!proyecto) return;
    await onGuardar(lista);
    const huella = (xs: CostoEvento[]) =>
      JSON.stringify(
        (xs || [])
          .map((c) => [c.id, c.tipo, Number(c.valor) || 0, (c.concepto || "").trim(), c.verificacion?.huella ?? ""])
          .sort((a, b) => String(a[0]).localeCompare(String(b[0])))
      );
    const { data, error } = await supabase
      .from("projects")
      .select("costos")
      .eq("id", proyecto.id)
      .single();
    if (error) throw new Error("No se pudo comprobar en la base: " + error.message);
    const enBase = ((data as { costos?: CostoEvento[] } | null)?.costos || []) as CostoEvento[];
    if (huella(enBase) !== huella(lista)) {
      throw new Error(
        "La base no tiene los costos que escribiste. Revisa la conexión y vuelve a dar Guardar; no cierres la ventana."
      );
    }
    const reales = lineasReales(enBase);
    const suma = reales.reduce((s, c) => s + (Number(c.valor) || 0), 0);

    // Checklist completo -> se cierran. Si quien verifica quita algun check,
    // se reabren.
    let avisoCierre = "";
    if (puedeVerificar) {
      const completo = enBase.length > 0 && enBase.every(lineaVerificada);
      if (completo && !cierre) {
        await updateProjectMultiple(proyecto.id, {
          costosVerificacion: { por: user?.email ?? "", en: new Date().toISOString(), huella: "" },
        });
        avisoCierre = " Checklist completo: costos cerrados, nadie más puede modificarlos.";
      } else if (!completo && cierre) {
        await updateProjectMultiple(proyecto.id, { costosVerificacion: null });
        avisoCierre = " Faltan checks: los costos quedan abiertos otra vez.";
      }
    }

    toast({
      title: avisoCierre.includes("cerrados") ? "🔒 Costos guardados y cerrados" : "✓ Costos guardados",
      description: marcadoSinTerceros(enBase)
        ? `Quedó registrado que el evento no tuvo costos de terceros.`
        : `${reales.length} línea${reales.length === 1 ? "" : "s"} · ${new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(suma)} confirmados en la base.` + avisoCierre,
    });
    setInicial(JSON.stringify({ l: lineasReales(lista), st: marcadoSinTerceros(lista), m: marca?.verificacion ?? null }));
    onOpenChange(false);
  };

  // Con la casilla marcada el evento cuesta cero, haya o no lineas en
  // pantalla: lo que se va a guardar es la marca.
  const total = useMemo(
    () => (sinTerceros ? 0 : lineas.reduce((suma, l) => suma + (Number(l.valor) || 0), 0)),
    [lineas, sinTerceros]
  );

  const porTipo = useMemo(() => {
    const mapa = new Map<TipoCosto, number>();
    lineas.forEach((l) => {
      mapa.set(l.tipo, (mapa.get(l.tipo) || 0) + (Number(l.valor) || 0));
    });
    return sinTerceros
      ? []
      : [...mapa.entries()].filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]);
  }, [lineas, sinTerceros]);

  const ingreso = Number(proyecto?.ingresoTotal) || 0;
  const utilidad = ingreso - total;
  const margen = ingreso > 0 ? (utilidad / ingreso) * 100 : null;

  const cambiar = (id: string, cambios: Partial<CostoEvento>) =>
    setLineas((prev) => prev.map((l) => (l.id === id ? { ...l, ...cambios } : l)));

  const guardar = async () => {
    // Declarar que no hubo costos de terceros y a la vez cargar costos es
    // contradictorio. Manda lo declarado: se guarda solo la marca.
    if (sinTerceros) {
      setGuardando(true);
      try {
        await guardarYComprobar([marca ?? lineaDeMarca(user?.email)]);
      } catch (error: unknown) {
        toast({
          title: "No se pudo guardar",
          description: error instanceof Error ? error.message : "Intenta de nuevo",
          variant: "destructive",
        });
      } finally {
        setGuardando(false);
      }
      return;
    }

    // Una linea sin concepto ni beneficiario y en cero es una fila que se
    // agrego y no se lleno: se descarta en vez de guardar basura.
    const limpias = lineas.filter(
      (l) => l.concepto.trim() || l.beneficiario.trim() || Number(l.valor) > 0
    );
    const sinValor = limpias.filter((l) => !(Number(l.valor) > 0));
    if (sinValor.length > 0) {
      toast({
        title: "Falta el valor",
        description: `Hay ${sinValor.length} línea${sinValor.length === 1 ? "" : "s"} sin valor. Escríbelo o borra la línea.`,
        variant: "destructive",
      });
      return;
    }

    setGuardando(true);
    try {
      await guardarYComprobar(limpias.map((l) => ({ ...l, valor: Number(l.valor) || 0 })));
    } catch (error: unknown) {
      toast({
        title: "No se pudo guardar",
        description: error instanceof Error ? error.message : "Intenta de nuevo",
        variant: "destructive",
      });
    } finally {
      setGuardando(false);
    }
  };

  /** Pone o quita el check de una linea, con la huella de como esta AHORA. */
  const verificar = (c: CostoEvento, si: boolean): CostoEvento => ({
    ...c,
    verificacion: si ? { por: user?.email ?? "", en: new Date().toISOString(), huella: huellaDeLinea(c) } : null,
  });

  const reabrir = async () => {
    if (!proyecto) return;
    setReabriendo(true);
    try {
      await updateProjectMultiple(proyecto.id, { costosVerificacion: null });
      const { data } = await supabase.from("projects").select("costos_verificados_en").eq("id", proyecto.id).single();
      if ((data as { costos_verificados_en?: string | null } | null)?.costos_verificados_en) {
        throw new Error("La base no reabrió los costos.");
      }
      toast({ title: "Costos reabiertos", description: "Ya se pueden agregar o cambiar costos. Se cierran otra vez cuando completes el checklist y guardes." });
    } catch (e) {
      toast({ title: "No se pudo reabrir", description: e instanceof Error ? e.message : "Intenta de nuevo", variant: "destructive" });
    } finally {
      setReabriendo(false);
    }
  };

  if (!proyecto) return null;

  const lineasVisibles = sinTerceros ? (marca ? [marca] : []) : lineas;
  const hechas = lineasVisibles.filter(lineaVerificada).length;
  const verificarTodas = () => {
    if (sinTerceros) {
      setMarca((m) => verificar(m ?? lineaDeMarca(user?.email), true));
    } else {
      setLineas((prev) => prev.map((l) => (lineaVerificada(l) ? l : verificar(l, true))));
    }
  };

  return (
    <>
    <Dialog open={open} onOpenChange={pedirCierre}>
      <DialogContent className="sm:max-w-2xl sm:max-h-[88vh] flex flex-col">
        <DialogHeader className="pr-10">
          <DialogTitle className="flex items-center gap-2 text-left text-base">
            <Receipt className="h-4 w-4 shrink-0" />
            Costos · {proyecto.evento || "Sin nombre"}
          </DialogTitle>
          <DialogDescription className="text-left">
            Lo que costó el evento: proveedores, personal, transporte y demás.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 space-y-2 overflow-y-auto">
          {cierre && (
            <div className="flex flex-wrap items-center gap-2 rounded-lg border border-emerald-500/40 bg-emerald-500/5 p-3 text-sm">
              <Lock className="h-4 w-4 shrink-0 text-emerald-500" />
              <span className="min-w-[12rem] flex-1">
                <strong>Costos cerrados</strong> por {cierre.por || "—"} ·{" "}
                {new Date(cierre.en).toLocaleString("es-CO", { timeZone: "America/Bogota", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}
                . {puedeVerificar ? "Si los reabres, el equipo puede volver a cargar costos." : "Ya no se pueden agregar ni cambiar costos."}
              </span>
              {puedeVerificar && (
                <Button size="sm" variant="outline" className="h-8 text-xs" disabled={reabriendo || hayCambios} onClick={reabrir}>
                  {reabriendo && <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />}
                  Reabrir costos
                </Button>
              )}
            </div>
          )}
          {/* Arriba del todo: muchas veces la respuesta es "no hubo", y asi no
              toca agregar una linea de mentira para poder cerrar el evento. */}
          <label
            className={`flex items-start gap-2.5 rounded-lg border p-3 ${
              sinTerceros ? "border-primary/50 bg-primary/5" : "border-border/70"
            } ${soloLectura ? "" : "cursor-pointer"}`}
          >
            <Checkbox
              checked={sinTerceros}
              disabled={soloLectura}
              onCheckedChange={(v) => setSinTerceros(v === true)}
              className="mt-0.5"
            />
            <span className="min-w-0">
              <span className="block text-sm font-medium">
                Este evento no tuvo costos de terceros
              </span>
              <span className="mt-0.5 block text-xs text-muted-foreground">
                Se hizo con equipo propio y personal de nómina, o lo cubrió otro
                contrato. Queda registrado como resuelto y deja de aparecer en
                rojo.
              </span>
            </span>
          </label>

          {sinTerceros && (
            <CheckLinea
              linea={marca}
              puede={puedeVerificar}
              onCambiar={(si) => setMarca((m) => verificar(m ?? lineaDeMarca(user?.email), si))}
            />
          )}

          {lineasVisibles.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 rounded-md bg-muted/40 px-3 py-1.5 text-xs">
              <ShieldCheck className={"h-3.5 w-3.5 " + (hechas === lineasVisibles.length ? "text-emerald-500" : "text-muted-foreground")} />
              <span className="flex-1">
                {hechas === lineasVisibles.length
                  ? cierre
                    ? "Todos los costos están verificados"
                    : puedeVerificar
                      ? "Checklist completo: al dar Guardar los costos quedan cerrados"
                      : "Todos los costos están verificados"
                  : `${hechas} de ${lineasVisibles.length} verificado${lineasVisibles.length === 1 ? "" : "s"}` +
                    (puedeVerificar ? " · al completar el checklist y guardar, se cierran" : "")}
              </span>
              {puedeVerificar && hechas < lineasVisibles.length && (
                <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={verificarTodas}>
                  Marcar todas
                </Button>
              )}
            </div>
          )}

          {sinTerceros && lineas.length > 0 && (
            <p className="rounded-lg border border-dashed border-border px-3 py-2 text-xs text-muted-foreground">
              Al guardar se quitarán las {lineas.length} línea
              {lineas.length === 1 ? "" : "s"} de costo cargadas. Desmarca la
              casilla si quieres conservarlas.
            </p>
          )}

          {!sinTerceros && lineas.length === 0 && (
            <div className="rounded-lg border border-dashed border-border p-6 text-center">
              <p className="text-sm font-medium">Todavía no hay costos cargados</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {soloLectura
                  ? "Nadie ha registrado costos para este evento."
                  : "Agrega una línea por cada proveedor o persona que se pagó."}
              </p>
            </div>
          )}

          {!sinTerceros && lineas.map((linea) => (
            <div key={linea.id} className="rounded-lg border border-border/70 p-3">
              <div className="grid gap-2 sm:grid-cols-[150px_1fr_auto]">
                <div>
                  <Label className="text-[10px] uppercase text-muted-foreground">Tipo</Label>
                  <Select
                    value={linea.tipo}
                    onValueChange={(v) =>
                      cambiar(linea.id, { tipo: v as TipoCosto, beneficiarioId: undefined })
                    }
                    disabled={soloLectura}
                  >
                    <SelectTrigger className="mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {TIPOS.map((t) => (
                        <SelectItem key={t.valor} value={t.valor}>
                          {t.nombre}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="min-w-0">
                  <Label className="text-[10px] uppercase text-muted-foreground">
                    {linea.tipo === "personal" ? "Persona" : "Proveedor o a quién se le pagó"}
                  </Label>
                  <div className="mt-1">
                    {soloLectura ? (
                      <Input value={linea.beneficiario} readOnly />
                    ) : linea.tipo === "personal" ? (
                      <EmpleadoAutocomplete
                        value={linea.beneficiario}
                        onChange={(nombre, empleadoId) =>
                          cambiar(linea.id, { beneficiario: nombre, beneficiarioId: empleadoId })
                        }
                        placeholder="Buscar empleado..."
                      />
                    ) : linea.tipo === "proveedor" || linea.tipo === "transporte" ? (
                      <ProveedorAutocomplete
                        value={linea.beneficiario}
                        onChange={(nombre, proveedorId) =>
                          cambiar(linea.id, { beneficiario: nombre, beneficiarioId: proveedorId })
                        }
                      />
                    ) : (
                      <Input
                        value={linea.beneficiario}
                        onChange={(e) => cambiar(linea.id, { beneficiario: e.target.value })}
                        placeholder="Nombre"
                      />
                    )}
                  </div>
                </div>

                {!soloLectura && (
                  <div className="flex items-end">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                      onClick={() => setLineas((prev) => prev.filter((l) => l.id !== linea.id))}
                      title="Borrar esta línea"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </div>

              <div className="mt-2 grid gap-2 sm:grid-cols-[1fr_170px]">
                <div>
                  <Label className="text-[10px] uppercase text-muted-foreground">Concepto</Label>
                  <Input
                    className="mt-1"
                    value={linea.concepto}
                    readOnly={soloLectura}
                    onChange={(e) => cambiar(linea.id, { concepto: e.target.value })}
                    placeholder="Ej: operario de montaje, alquiler de pantalla"
                  />
                </div>
                <div>
                  <Label className="text-[10px] uppercase text-muted-foreground">Valor</Label>
                  <Input
                    className="mt-1 tabular-nums"
                    type="number"
                    inputMode="numeric"
                    min={0}
                    step={1000}
                    value={linea.valor || ""}
                    readOnly={soloLectura}
                    onChange={(e) => cambiar(linea.id, { valor: Number(e.target.value) || 0 })}
                    placeholder="0"
                  />
                  {Number(linea.valor) > 0 && (
                    <p className="mt-1 text-[11px] text-muted-foreground tabular-nums">
                      {pesos.format(Number(linea.valor))}
                    </p>
                  )}
                </div>
              </div>
              <CheckLinea
                linea={linea}
                puede={puedeVerificar}
                onCambiar={(si) => setLineas((prev) => prev.map((l) => (l.id === linea.id ? verificar(l, si) : l)))}
              />
            </div>
          ))}

          {!soloLectura && !sinTerceros && (
            <Button
              variant="outline"
              className="h-11 w-full"
              onClick={() => setLineas((prev) => [...prev, lineaNueva()])}
            >
              <Plus className="mr-2 h-4 w-4" />
              Agregar línea
            </Button>
          )}
        </div>

        {/* Los papeles que respaldan lo anterior. Se suben y se guardan al
            momento, no al dar Guardar: un archivo a medio subir que se pierde
            porque alguien cerro la ventana es peor que uno de mas. */}
        <div className="shrink-0 space-y-2 rounded-lg border border-border p-3">
          <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
            Soportes (facturas, recibos, cuentas de cobro)
          </div>
          {soloLectura ? (
            (proyecto.costosAdjuntos || []).length > 0 ? (
              <ListaAdjuntos adjuntos={proyecto.costosAdjuntos || []} etiqueta="Archivos" />
            ) : (
              <p className="text-[11px] text-muted-foreground">Sin soportes cargados.</p>
            )
          ) : (
            <AttachmentManager
              attachments={proyecto.costosAdjuntos || []}
              onAttachmentsChange={(archivos) => { void onGuardarAdjuntos(archivos); }}
              acceptedTypes=".pdf,.jpg,.jpeg,.png,.xlsx,.xls,.doc,.docx"
              fieldName="costos"
              projectId={proyecto.id}
            />
          )}
        </div>

        {/* El resumen se queda fijo: es lo que se va a mirar mientras se
            escriben las lineas. */}
        <div className="shrink-0 space-y-2 rounded-lg border border-border p-3">
          {porTipo.length > 0 && (
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
              {porTipo.map(([tipo, valor]) => (
                <span key={tipo} className="tabular-nums">
                  {nombreDeTipo(tipo)}: {pesos.format(valor)}
                </span>
              ))}
            </div>
          )}
          <div className="grid grid-cols-3 gap-2 text-sm">
            <div>
              <div className="text-[10px] uppercase text-muted-foreground">Costos</div>
              <div className="font-semibold tabular-nums">{pesos.format(total)}</div>
            </div>
            <div>
              <div className="text-[10px] uppercase text-muted-foreground">Ingreso total</div>
              <div className="font-semibold tabular-nums">{pesos.format(ingreso)}</div>
            </div>
            <div>
              <div className="text-[10px] uppercase text-muted-foreground">Utilidad</div>
              <div
                className={`font-semibold tabular-nums ${
                  utilidad < 0 ? "text-destructive" : "text-emerald-500"
                }`}
              >
                {pesos.format(utilidad)}
                {margen !== null && (
                  <span className="ml-1 text-[11px] font-normal text-muted-foreground">
                    ({margen.toFixed(0)}%)
                  </span>
                )}
              </div>
            </div>
          </div>
          <p className="text-[11px] text-muted-foreground">
            Utilidad = Ingreso total − costos. Es control interno del evento, no
            contabilidad: no descuenta impuestos ni dice si ya se cobró.
          </p>
        </div>

        <DialogFooter className="shrink-0 gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => pedirCierre(false)} className="h-11 w-full sm:h-10 sm:w-auto">
            {soloLectura ? "Cerrar" : "Cancelar"}
          </Button>
          {!soloLectura && (
            <Button onClick={guardar} disabled={guardando} className="h-11 w-full sm:h-10 sm:w-auto">
              {guardando ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {guardando ? "Guardando y comprobando…" : "Guardar costos"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <AlertDialog open={confirmarSalida} onOpenChange={setConfirmarSalida}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Tienes costos sin guardar</AlertDialogTitle>
          <AlertDialogDescription>
            Si cierras ahora se pierde lo que escribiste. ¿Quieres volver y darle "Guardar costos"?
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Volver a los costos</AlertDialogCancel>
          <AlertDialogAction
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            onClick={() => {
              setConfirmarSalida(false);
              onOpenChange(false);
            }}
          >
            Salir sin guardar
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
    </>
  );
}

/**
 * El check de una linea. auxbbm@ (y Bayron) lo marcan; los demas ven si esta
 * verificada o no. Si la linea cambio despues del check, se avisa en ambar.
 */
function CheckLinea({
  linea,
  puede,
  onCambiar,
}: {
  linea: CostoEvento | null;
  puede: boolean;
  onCambiar: (si: boolean) => void;
}) {
  const ok = linea ? lineaVerificada(linea) : false;
  const cambio = linea ? lineaCambioTrasVerificar(linea) : false;
  const quien = linea?.verificacion?.por || "";
  const cuando = linea?.verificacion?.en
    ? new Date(linea.verificacion.en).toLocaleDateString("es-CO", { timeZone: "America/Bogota", day: "numeric", month: "short" })
    : "";
  const texto = ok
    ? `Verificado por ${quien} · ${cuando}`
    : cambio
      ? `Cambió después de verificarse (${quien}, ${cuando})`
      : "Sin verificar";
  const color = ok ? "text-emerald-500" : cambio ? "text-amber-500" : "text-muted-foreground";

  if (!puede) {
    return (
      <p className={"mt-2 flex items-center gap-1 text-[11px] " + color}>
        {ok ? <ShieldCheck className="h-3.5 w-3.5" /> : cambio ? <AlertTriangle className="h-3.5 w-3.5" /> : null}
        {texto}
      </p>
    );
  }
  return (
    <label className={"mt-2 flex cursor-pointer items-center gap-2 rounded-md border px-2 py-1.5 text-xs " + (ok ? "border-emerald-500/40 bg-emerald-500/5" : cambio ? "border-amber-500/40 bg-amber-500/5" : "border-dashed border-border")}>
      <Checkbox checked={ok} onCheckedChange={(v) => onCambiar(v === true)} />
      <span className={color}>{ok ? texto : cambio ? texto + " — vuelve a marcar" : "Verifiqué este costo"}</span>
    </label>
  );
}

export default CostosEventoDialog;
