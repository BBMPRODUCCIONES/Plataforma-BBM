import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  ScanLine, Camera, CameraOff, Check, X, Undo2, Loader2, ArrowUpRight, ArrowDownLeft,
} from "lucide-react";
import { Activo, NuevoMovimiento } from "@/hooks/useBodega";
import { Project } from "@/types";
import { cn } from "@/lib/utils";

/**
 * Despacho con pistola de codigo de barras.
 *
 * Una pistola USB o Bluetooth no es un dispositivo especial: se comporta como
 * un teclado. Teclea el codigo muy rapido y manda un Enter. Por eso aqui no
 * hay driver ni permisos: hay un campo enfocado que recoge lo que llegue y
 * reacciona al Enter. La misma pantalla sirve para la pistola y para teclear
 * el codigo a mano cuando la etiqueta esta rota.
 *
 * El modo es continuo a proposito. Cargando un camion no se puede soltar la
 * pistola para buscar cada equipo con el mouse: se elige una vez si es salida
 * o entrada y para que evento, y de ahi en adelante son disparos seguidos.
 */

type Tipo = "salida" | "entrada";

/** Un disparo ya resuelto y registrado. */
interface Linea {
  id: string;
  codigo: string;
  elemento: string;
  cantidad: number;
}

/** Un disparo que no se pudo registrar solo y espera al usuario. */
interface Pendiente {
  codigo: string;
  /** Mas de un activo comparte este codigo: hay que escoger. */
  opciones: Activo[];
  /** El activo va a granel: hay que decir cuantas unidades. */
  pideCantidad: Activo | null;
}

interface Props {
  activos: Activo[];
  proyectos: Project[];
  abierto: boolean;
  onCerrar: () => void;
  onGuardar: (m: NuevoMovimiento, opciones?: { recargar?: boolean }) => Promise<boolean>;
  onTerminar: () => void;
}

/** Dos pitidos distintos. En bodega nadie mira la pantalla mientras carga. */
function pitar(ok: boolean) {
  try {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const osc = ctx.createOscillator();
    const vol = ctx.createGain();
    osc.connect(vol); vol.connect(ctx.destination);
    osc.frequency.value = ok ? 1180 : 320;
    vol.gain.setValueAtTime(0.12, ctx.currentTime);
    vol.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + (ok ? 0.1 : 0.42));
    osc.start();
    osc.stop(ctx.currentTime + (ok ? 0.1 : 0.42));
    osc.onended = () => void ctx.close();
  } catch {
    /* sin sonido no pasa nada: el color y el texto siguen ahi */
  }
}

export function EscanerBodega({ activos, proyectos, abierto, onCerrar, onGuardar, onTerminar }: Props) {
  const [fase, setFase] = useState<"config" | "escaneando">("config");
  const [tipo, setTipo] = useState<Tipo>("salida");
  const [proyectoId, setProyectoId] = useState("");
  const [lineas, setLineas] = useState<Linea[]>([]);
  const [pendiente, setPendiente] = useState<Pendiente | null>(null);
  const [cantidadPendiente, setCantidadPendiente] = useState(1);
  const [aviso, setAviso] = useState<{ ok: boolean; texto: string } | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [camaraActiva, setCamaraActiva] = useState(false);
  const [camaraError, setCamaraError] = useState<string | null>(null);

  const campoRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const pararCamara = useRef<(() => void) | null>(null);
  const ultimoLeido = useRef<{ codigo: string; cuando: number }>({ codigo: "", cuando: 0 });
  /**
   * La camara se enciende una vez y su callback vive mientras dure el video,
   * pero procesar() se vuelve a crear en cada render. Sin esta referencia, el
   * callback seguiria llamando a la version del primer render, con la lista de
   * escaneados vacia, y dejaria sacar de mas.
   */
  const procesarRef = useRef<(c: string) => void>(() => undefined);

  const esSalida = tipo === "salida";

  const eventos = useMemo(
    () => proyectos
      .filter((p) => !p.isDeleted && p.evento)
      .sort((a, b) => (b.fechaEjecucionInicio || "").localeCompare(a.fechaEjecucionInicio || ""))
      .slice(0, 120),
    [proyectos]
  );

  const porCodigo = useMemo(() => {
    const m = new Map<string, Activo[]>();
    activos.forEach((a) => {
      const k = String(a.codigo).trim();
      const l = m.get(k); if (l) l.push(a); else m.set(k, [a]);
    });
    return m;
  }, [activos]);

  /**
   * Cuantas unidades de este activo se pueden mover todavia.
   *
   * Hay que descontar lo que ya se escaneo en esta sesion porque el panel no
   * recarga entre disparo y disparo: a.disponible sigue siendo la foto del
   * momento en que se abrio el escaner. Sin esta resta, dos disparos seguidos
   * sobre la misma pieza unica la sacarian dos veces.
   *
   * Se resta en los dos sentidos: al sacar consume disponible, y al recibir
   * consume lo que todavia figura afuera.
   */
  const margen = useCallback(
    (a: Activo) => {
      const usado = lineas.filter((l) => l.id === a.id).reduce((s, l) => s + l.cantidad, 0);
      return (esSalida ? a.disponible : a.en_evento) - usado;
    },
    [esSalida, lineas]
  );

  const reiniciar = useCallback(() => {
    setFase("config"); setLineas([]); setPendiente(null); setAviso(null);
    setProyectoId(""); setCamaraError(null);
  }, []);

  // --- camara -------------------------------------------------------------
  const apagarCamara = useCallback(() => {
    pararCamara.current?.();
    pararCamara.current = null;
    setCamaraActiva(false);
  }, []);

  const encenderCamara = useCallback(async () => {
    setCamaraError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" } },
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => undefined);
      }
      setCamaraActiva(true);

      const detener = () => stream.getTracks().forEach((t) => t.stop());

      // Primero el lector del propio navegador, que no pesa nada. Chrome en
      // Android lo trae; Safari no, y ahi se baja la libreria aparte para no
      // cargarsela a todo el mundo en el paquete principal.
      const Nativo = (window as unknown as { BarcodeDetector?: new (o?: unknown) => { detect: (s: CanvasImageSource) => Promise<{ rawValue: string }[]> } }).BarcodeDetector;
      if (Nativo) {
        const det = new Nativo({ formats: ["code_128", "code_39", "ean_13", "ean_8", "itf", "codabar", "qr_code"] });
        let vivo = true;
        const mirar = async () => {
          if (!vivo || !videoRef.current) return;
          try {
            const r = await det.detect(videoRef.current);
            if (r[0]?.rawValue) procesarRef.current(r[0].rawValue);
          } catch { /* un cuadro ilegible no es un error */ }
          if (vivo) setTimeout(mirar, 220);
        };
        void mirar();
        pararCamara.current = () => { vivo = false; detener(); };
        return;
      }

      const { BrowserMultiFormatReader } = await import("@zxing/browser");
      const lector = new BrowserMultiFormatReader();
      const control = await lector.decodeFromVideoElement(videoRef.current!, (res) => {
        if (res) procesarRef.current(res.getText());
      });
      pararCamara.current = () => { control.stop(); detener(); };
    } catch (e) {
      setCamaraError(
        e instanceof Error && /denied|NotAllowed/i.test(e.message)
          ? "No diste permiso de cámara. Puedes seguir con la pistola o escribiendo el código."
          : "No se pudo abrir la cámara. La pistola y el teclado siguen funcionando."
      );
      setCamaraActiva(false);
    }
  }, []);

  // --- el disparo ---------------------------------------------------------
  const registrar = useCallback(
    async (a: Activo, cantidad: number) => {
      const tope = margen(a);
      if (cantidad > tope) {
        setAviso({
          ok: false,
          texto: tope <= 0
            ? (esSalida ? `${a.elemento} ya no tiene unidades libres` : `${a.elemento} ya no figura afuera`)
            : `De ${a.elemento} solo quedan ${tope} por ${esSalida ? "sacar" : "recibir"}`,
        });
        pitar(false);
        campoRef.current?.focus();
        return;
      }
      setOcupado(true);
      const ok = await onGuardar({
        activo_id: a.id,
        tipo,
        cantidad,
        project_id: esSalida ? (proyectoId || null) : null,
        evento_nombre: esSalida
          ? (() => { const e = eventos.find((x) => x.id === proyectoId); return e ? `${e.evento}${e.cliente ? " · " + e.cliente : ""}` : null; })()
          : null,
        notas: "Registrado con lector de código de barras",
      }, { recargar: false });
      setOcupado(false);
      if (ok) {
        setLineas((l) => [{ id: a.id, codigo: a.codigo, elemento: a.elemento, cantidad }, ...l]);
        setAviso({ ok: true, texto: `${cantidad} × ${a.elemento}` });
        pitar(true);
      } else {
        setAviso({ ok: false, texto: `No se pudo registrar ${a.codigo}` });
        pitar(false);
      }
      campoRef.current?.focus();
    },
    [esSalida, eventos, margen, onGuardar, proyectoId, tipo]
  );

  const procesar = useCallback(
    (crudo: string) => {
      const codigo = crudo.replace(/\s+/g, "").trim();
      if (!codigo) return;

      // La camara dispara el mismo codigo muchas veces por segundo.
      const ahora = Date.now();
      if (ultimoLeido.current.codigo === codigo && ahora - ultimoLeido.current.cuando < 2500) return;
      ultimoLeido.current = { codigo, cuando: ahora };

      const encontrados = porCodigo.get(codigo) || [];
      if (encontrados.length === 0) {
        setAviso({ ok: false, texto: `El código ${codigo} no está en el inventario` });
        pitar(false);
        return;
      }
      if (encontrados.length > 1) {
        setPendiente({ codigo, opciones: encontrados, pideCantidad: null });
        pitar(false);
        return;
      }

      const a = encontrados[0];
      if (a.cantidad_total > 1) {
        setPendiente({ codigo, opciones: [], pideCantidad: a });
        setCantidadPendiente(1);
        return;
      }
      void registrar(a, 1);
    },
    [porCodigo, registrar]
  );

  useEffect(() => { procesarRef.current = procesar; }, [procesar]);

  // mantener el foco en el campo: la pistola escribe donde este el cursor
  useEffect(() => {
    if (fase !== "escaneando" || pendiente) return;
    const t = setInterval(() => {
      const act = document.activeElement;
      const enUnCampo = act instanceof HTMLInputElement || act instanceof HTMLTextAreaElement;
      if (!enUnCampo) campoRef.current?.focus();
    }, 700);
    return () => clearInterval(t);
  }, [fase, pendiente]);

  useEffect(() => { if (!abierto) { apagarCamara(); reiniciar(); } }, [abierto, apagarCamara, reiniciar]);
  useEffect(() => () => apagarCamara(), [apagarCamara]);

  const total = lineas.reduce((s, l) => s + l.cantidad, 0);

  const cerrarTodo = () => {
    apagarCamara();
    if (lineas.length) onTerminar();
    onCerrar();
  };

  return (
    <Dialog open={abierto} onOpenChange={(v) => !v && cerrarTodo()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ScanLine className="h-4 w-4" />
            {fase === "config" ? "Despachar con lector" : esSalida ? "Sacando de bodega" : "Recibiendo en bodega"}
          </DialogTitle>
          <DialogDescription className="text-left">
            {fase === "config"
              ? "Eliges una vez si es salida o entrada y para qué evento. Después solo disparas."
              : "Dispara la pistola sobre cada etiqueta. No tienes que tocar la pantalla entre equipo y equipo."}
          </DialogDescription>
        </DialogHeader>

        {fase === "config" ? (
          <div className="space-y-3">
            <div>
              <Label>¿Qué vas a hacer?</Label>
              <div className="mt-1 grid grid-cols-2 gap-2">
                <Button variant={esSalida ? "default" : "outline"} onClick={() => setTipo("salida")}>
                  <ArrowUpRight className="mr-1.5 h-4 w-4" />Sacar
                </Button>
                <Button variant={!esSalida ? "default" : "outline"} onClick={() => setTipo("entrada")}>
                  <ArrowDownLeft className="mr-1.5 h-4 w-4" />Recibir
                </Button>
              </div>
            </div>

            {esSalida && (
              <div>
                <Label>¿Para qué evento?</Label>
                <Select value={proyectoId} onValueChange={setProyectoId}>
                  <SelectTrigger><SelectValue placeholder="Sin evento (préstamo, taller, reparación)" /></SelectTrigger>
                  <SelectContent>
                    {eventos.map((e) => (
                      <SelectItem key={e.id} value={e.id}>
                        {e.evento}{e.fechaEjecucionInicio ? ` · ${e.fechaEjecucionInicio}` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <Button className="w-full" onClick={() => { setFase("escaneando"); setTimeout(() => campoRef.current?.focus(), 120); }}>
              Empezar a escanear
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            <Input
              ref={campoRef}
              autoFocus
              inputMode="numeric"
              placeholder="Dispara la pistola o escribe el código…"
              disabled={ocupado || !!pendiente}
              onKeyDown={(e) => {
                if (e.key !== "Enter") return;
                e.preventDefault();
                const v = (e.target as HTMLInputElement).value;
                (e.target as HTMLInputElement).value = "";
                procesar(v);
              }}
              className="text-center font-mono text-lg"
            />

            {aviso && (
              <div className={cn(
                "rounded-md border px-3 py-2 text-sm",
                aviso.ok
                  ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                  : "border-destructive/40 bg-destructive/10 text-destructive"
              )}>
                <span className="mr-1.5 inline-block align-middle">{aviso.ok ? <Check className="h-4 w-4" /> : <X className="h-4 w-4" />}</span>
                {aviso.texto}
              </div>
            )}

            {pendiente?.opciones.length ? (
              <div className="rounded-md border border-amber-500/40 bg-amber-500/10 p-3">
                <p className="mb-2 text-sm font-medium">
                  El código {pendiente.codigo} lo tienen dos equipos. ¿Cuál es?
                </p>
                <div className="space-y-1">
                  {pendiente.opciones.map((o) => (
                    <Button key={o.id} variant="outline" size="sm" className="w-full justify-start"
                            onClick={() => { setPendiente(null); void registrar(o, 1); }}>
                      {o.elemento}
                    </Button>
                  ))}
                </div>
                <Button variant="ghost" size="sm" className="mt-1 w-full" onClick={() => { setPendiente(null); campoRef.current?.focus(); }}>
                  Saltar este
                </Button>
              </div>
            ) : null}

            {pendiente?.pideCantidad ? (
              <div className="rounded-md border border-amber-500/40 bg-amber-500/10 p-3">
                <p className="mb-2 text-sm font-medium">{pendiente.pideCantidad.elemento}</p>
                <p className="mb-2 text-xs text-muted-foreground">
                  Este renglón va a granel ({pendiente.pideCantidad.cantidad_total} en total,{" "}
                  {margen(pendiente.pideCantidad)} que puedes mover ahora). ¿Cuántas unidades?
                </p>
                <div className="flex gap-2">
                  <Input type="number" min={1} autoFocus value={cantidadPendiente}
                         onChange={(e) => setCantidadPendiente(Number(e.target.value))}
                         onKeyDown={(e) => {
                           if (e.key === "Enter") {
                             e.preventDefault();
                             const a = pendiente.pideCantidad!;
                             setPendiente(null);
                             void registrar(a, Math.max(1, Math.round(cantidadPendiente)));
                           }
                         }} />
                  <Button onClick={() => { const a = pendiente.pideCantidad!; setPendiente(null); void registrar(a, Math.max(1, Math.round(cantidadPendiente))); }}>
                    Registrar
                  </Button>
                </div>
              </div>
            ) : null}

            <div className="flex items-center justify-between gap-2">
              <Button variant="outline" size="sm" onClick={() => (camaraActiva ? apagarCamara() : void encenderCamara())}>
                {camaraActiva ? <CameraOff className="mr-1.5 h-4 w-4" /> : <Camera className="mr-1.5 h-4 w-4" />}
                {camaraActiva ? "Apagar cámara" : "Usar cámara"}
              </Button>
              {ocupado && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
              <span className="text-xs text-muted-foreground">
                {lineas.length} disparo(s) · {total} unidad(es)
              </span>
            </div>

            {camaraError && <p className="text-xs text-destructive">{camaraError}</p>}
            <video ref={videoRef} playsInline muted
                   className={cn("w-full rounded-md bg-black", camaraActiva ? "block" : "hidden")}
                   style={{ maxHeight: 220 }} />

            {lineas.length > 0 && (
              <div className="max-h-44 overflow-y-auto rounded-md border">
                <ul className="divide-y text-sm">
                  {lineas.map((l, i) => (
                    <li key={`${l.id}-${i}`} className="flex items-center justify-between gap-2 px-2 py-1.5">
                      <span className="min-w-0 truncate">
                        <span className="font-mono text-xs text-muted-foreground">{l.codigo}</span> {l.elemento}
                      </span>
                      <span className="shrink-0 tabular-nums">{l.cantidad}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="flex gap-2">
              {/* Al volver atras se vacia la lista y se recarga: los movimientos
                  ya estan guardados, y si aqui se cambia de sacar a recibir, un
                  conteo heredado de la tanda anterior descuadraria el margen. */}
              <Button variant="outline" className="flex-1"
                      onClick={() => { apagarCamara(); if (lineas.length) onTerminar(); setLineas([]); setAviso(null); setFase("config"); }}>
                <Undo2 className="mr-1.5 h-4 w-4" />Cambiar evento
              </Button>
              <Button className="flex-1" onClick={cerrarTodo}>Terminar</Button>
            </div>

            <p className="text-[11px] text-muted-foreground">
              Cada disparo queda registrado al instante. Si uno sale mal, se corrige con el
              movimiento contrario desde el inventario: un movimiento no se borra.
            </p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
