import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Camera, Loader2, LogIn, LogOut, MapPin, RotateCcw, Check, SwitchCamera, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { diaBogota, fechaLarga, horaBogota, Marcacion, TipoMarca } from "@/lib/marcaciones";

/**
 * Marcar llegada o salida: foto + hora + ubicacion.
 *
 * Al tocar el boton se pide la ubicacion y se abre la camara EN VIVO dentro
 * del planner (no hay forma de escoger una foto de la galeria): la foto es el
 * cuadro que se ve en ese momento.
 * Con la foto tomada se estampa abajo una franja con el tipo, el nombre, la
 * fecha y hora, las coordenadas y la direccion. La persona la revisa y
 * confirma; ahi se sube y se guarda. La hora que vale es la del servidor.
 */

interface Ubicacion {
  lat: number;
  lng: number;
  precision: number;
  direccion: string;
}

const NOMBRE_TIPO: Record<TipoMarca, string> = { entrada: "LLEGADA", salida: "SALIDA" };

function pedirUbicacion(): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("Este dispositivo no permite leer la ubicación."));
      return;
    }
    navigator.geolocation.getCurrentPosition(resolve, (e) => {
      reject(
        new Error(
          e.code === e.PERMISSION_DENIED
            ? "No diste permiso de ubicación. Actívalo para el planner en el navegador y vuelve a intentar."
            : "No se pudo leer la ubicación. Revisa que el GPS esté prendido y vuelve a intentar."
        )
      );
    }, { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 });
  });
}

async function direccionDe(lat: number, lng: number): Promise<string> {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 6000);
    const r = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&accept-language=es&zoom=18`,
      { signal: ctrl.signal }
    );
    clearTimeout(t);
    if (!r.ok) return "";
    const d = (await r.json()) as { display_name?: string };
    return (d.display_name || "").split(",").slice(0, 4).join(",").trim();
  } catch {
    return "";
  }
}

/** Dibuja la foto con la franja de datos abajo y devuelve un JPEG. */
async function estampar(video: HTMLVideoElement, espejo: boolean, lineas: string[]): Promise<Blob> {
  const vw = video.videoWidth;
  const vh = video.videoHeight;
  if (!vw || !vh) throw new Error("La cámara todavía no muestra imagen. Espera un segundo y vuelve a tomar la foto.");
  const max = 1280;
  const escala = Math.min(1, max / Math.max(vw, vh));
  const w = Math.round(vw * escala);
  const h = Math.round(vh * escala);
  const fuente = Math.max(14, Math.round(w / 34));
  const alto = Math.round(fuente * 1.45 * lineas.length + fuente * 1.2);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h + alto;
  const ctx = canvas.getContext("2d")!;
  if (espejo) {
    // La camara de frente se ve como espejo; la foto se guarda derecha.
    ctx.save();
    ctx.translate(w, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(video, 0, 0, w, h);
    ctx.restore();
  } else {
    ctx.drawImage(video, 0, 0, w, h);
  }
  ctx.fillStyle = "#000";
  ctx.fillRect(0, h, w, alto);
  ctx.fillStyle = "#fff";
  ctx.textBaseline = "top";
  lineas.forEach((texto, i) => {
    ctx.font = `${i === 0 ? "700" : "500"} ${fuente}px Montserrat, Arial, sans-serif`;
    let t = texto;
    while (t.length > 4 && ctx.measureText(t).width > w - fuente * 1.2) t = t.slice(0, -2);
    if (t !== texto) t = t.slice(0, -1) + "…";
    ctx.fillText(t, fuente * 0.6, h + fuente * 0.6 + i * fuente * 1.45);
  });
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("No se pudo preparar la foto"))), "image/jpeg", 0.85)
  );
}

export function MarcarAsistencia({ onMarcado }: { onMarcado?: () => void }) {
  const { user } = useAuth();
  const [nombre, setNombre] = useState("");
  const [hoy, setHoy] = useState<Marcacion[]>([]);
  const [tipo, setTipo] = useState<TipoMarca | null>(null);
  const [paso, setPaso] = useState<"nada" | "preparando" | "revisar" | "guardando">("nada");
  const [preview, setPreview] = useState<{ blob: Blob; url: string; ubic: Ubicacion } | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [camara, setCamara] = useState<"user" | "environment" | null>(null);
  const [camaraLista, setCamaraLista] = useState(false);
  const ubicacionRef = useRef<Promise<GeolocationPosition> | null>(null);

  const cargarHoy = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from("marcaciones" as never)
      .select("*")
      .eq("user_id", user.id)
      .order("marcada_en", { ascending: false })
      .limit(10);
    const d = diaBogota(new Date().toISOString());
    setHoy(((data as unknown as Marcacion[]) || []).filter((m) => diaBogota(m.marcada_en) === d));
  }, [user]);

  useEffect(() => {
    if (!user) return;
    void cargarHoy();
    void (async () => {
      const { data } = await supabase.from("profiles").select("full_name").eq("id", user.id).maybeSingle();
      setNombre(((data as { full_name?: string } | null)?.full_name || user.email || "").trim());
    })();
  }, [user, cargarHoy]);

  const ultima = hoy[0];
  const sugerido: TipoMarca = ultima?.tipo === "entrada" ? "salida" : "entrada";
  const otro: TipoMarca = sugerido === "entrada" ? "salida" : "entrada";
  const enJornada = ultima?.tipo === "entrada";
  // Reloj para mostrar cuanto lleva en la jornada.
  const [ahora, setAhora] = useState(() => Date.now());
  useEffect(() => {
    if (!enJornada) return;
    const t = setInterval(() => setAhora(Date.now()), 30_000);
    return () => clearInterval(t);
  }, [enJornada]);
  const lleva = enJornada ? Math.max(0, (ahora - new Date(ultima!.marcada_en).getTime()) / 3_600_000) : 0;
  const llevaTexto = `${Math.floor(lleva)} h ${String(Math.round((lleva % 1) * 60) % 60).padStart(2, "0")} min`;

  const apagarCamara = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setCamaraLista(false);
  }, []);

  const prenderCamara = useCallback(
    async (modo: "user" | "environment") => {
      apagarCamara();
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error("Este navegador no deja usar la cámara. Abre el planner en Chrome o Safari.");
      }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: modo, width: { ideal: 1280 }, height: { ideal: 1280 } },
          audio: false,
        });
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => undefined);
        }
      } catch (e) {
        const nombreError = (e as { name?: string })?.name;
        throw new Error(
          nombreError === "NotAllowedError"
            ? "No diste permiso de cámara. Actívalo para el planner en el navegador y vuelve a intentar."
            : "No se pudo abrir la cámara. Revisa que ninguna otra app la esté usando."
        );
      }
    },
    [apagarCamara]
  );

  // Al cerrar la pagina se apaga la camara.
  useEffect(() => () => apagarCamara(), [apagarCamara]);

  useEffect(() => {
    if (!camara) return;
    prenderCamara(camara).catch((e) => {
      toast.error("No se pudo abrir la cámara", { description: e instanceof Error ? e.message : "" });
      setCamara(null);
      setPaso("nada");
    });
  }, [camara, prenderCamara]);

  const empezar = (t: TipoMarca) => {
    setTipo(t);
    // La ubicacion se pide ya, mientras la persona se prepara para la foto.
    ubicacionRef.current = pedirUbicacion();
    ubicacionRef.current.catch(() => undefined);
    setCamara("user");
  };

  const cerrarCamara = () => {
    apagarCamara();
    setCamara(null);
  };

  const tomarFoto = async () => {
    const video = videoRef.current;
    if (!video || !tipo || !camara) return;
    setPaso("preparando");
    try {
      const pos = await (ubicacionRef.current || pedirUbicacion());
      const lat = pos.coords.latitude;
      const lng = pos.coords.longitude;
      const precision = Math.round(pos.coords.accuracy || 0);
      const direccion = await direccionDe(lat, lng);
      const ahora = new Date();
      const lineas = [
        `${NOMBRE_TIPO[tipo]} · ${nombre}`,
        `${fechaLarga(ahora)} · ${horaBogota(ahora.toISOString(), true)} (hora Colombia)`,
        `${lat.toFixed(6)}, ${lng.toFixed(6)}  (±${precision} m)`,
        direccion || "Dirección no disponible",
        "BBM Producciones · Planner",
      ];
      const blob = await estampar(video, camara === "user", lineas);
      cerrarCamara();
      setPreview({ blob, url: URL.createObjectURL(blob), ubic: { lat, lng, precision, direccion } });
      setPaso("revisar");
    } catch (e) {
      setPaso("nada");
      toast.error("No se pudo marcar", { description: e instanceof Error ? e.message : "Intenta de nuevo" });
    }
  };

  const descartar = () => {
    if (preview) URL.revokeObjectURL(preview.url);
    setPreview(null);
    setPaso("nada");
  };

  const confirmar = async () => {
    if (!user || !preview || !tipo) return;
    setPaso("guardando");
    try {
      const ruta = `${user.id}/${new Date().toISOString().replace(/[:.]/g, "-")}-${tipo}.jpg`;
      const { error: errSubir } = await supabase.storage
        .from("marcaciones")
        .upload(ruta, preview.blob, { contentType: "image/jpeg", upsert: false });
      if (errSubir) throw new Error("No se pudo subir la foto: " + errSubir.message);
      const { error } = await supabase.from("marcaciones" as never).insert({
        nombre,
        tipo,
        lat: preview.ubic.lat,
        lng: preview.ubic.lng,
        precision_m: preview.ubic.precision,
        direccion: preview.ubic.direccion,
        foto_path: ruta,
      } as never);
      if (error) throw new Error(error.message);
      toast.success(tipo === "entrada" ? "Llegada registrada" : "Salida registrada", {
        description: `${horaBogota(new Date().toISOString())} · ${preview.ubic.direccion || "ubicación guardada"}`,
      });
      descartar();
      void cargarHoy();
      onMarcado?.();
    } catch (e) {
      setPaso("revisar");
      toast.error("No se guardó la marca", { description: e instanceof Error ? e.message : "Intenta de nuevo" });
    }
  };

  return (
    <div className="panel-card space-y-4 rounded-xl border border-border bg-card p-4">
      {camara && createPortal(
        <div className="fixed inset-0 z-[70] flex flex-col bg-black">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            onLoadedData={() => setCamaraLista(true)}
            className={cn("min-h-0 flex-1 object-contain", camara === "user" && "-scale-x-100")}
          />
          <div className="flex items-center justify-between gap-3 bg-black p-4 pb-[calc(env(safe-area-inset-bottom,0px)+16px)] text-white">
            <Button type="button" variant="ghost" className="h-12 text-white hover:bg-white/10 hover:text-white" disabled={paso === "preparando"} onClick={() => { cerrarCamara(); setPaso("nada"); }}>
              <X className="mr-1 h-5 w-5" /> Cancelar
            </Button>
            <button
              type="button"
              aria-label="Tomar foto"
              disabled={!camaraLista || paso === "preparando"}
              onClick={() => void tomarFoto()}
              className="flex h-16 w-16 items-center justify-center rounded-full border-4 border-white bg-white/20 disabled:opacity-40"
            >
              {paso === "preparando" ? <Loader2 className="h-6 w-6 animate-spin" /> : <Camera className="h-6 w-6" />}
            </button>
            <Button type="button" variant="ghost" className="h-12 text-white hover:bg-white/10 hover:text-white" disabled={paso === "preparando"} onClick={() => setCamara((c) => (c === "user" ? "environment" : "user"))}>
              <SwitchCamera className="mr-1 h-5 w-5" /> Girar
            </Button>
          </div>
          <p className="bg-black px-4 pb-3 text-center text-xs text-white/70">
            {tipo === "entrada" ? "Llegada" : "Salida"} · la foto se toma en vivo; no se puede subir de la galería.
          </p>
        </div>,
        document.body
      )}

      {/* Estado de hoy, grande: lo primero que se lee en el celular. */}
      <div
        className={cn(
          "rounded-xl px-4 py-3 text-center",
          enJornada ? "bg-emerald-500/10 text-emerald-800" : "bg-muted/50 text-foreground"
        )}
      >
        <p className="text-xs font-medium uppercase tracking-wide opacity-70">
          {fechaLarga(new Date())}
        </p>
        {enJornada ? (
          <>
            <p className="mt-1 text-lg font-semibold">En jornada desde las {horaBogota(ultima!.marcada_en)}</p>
            <p className="text-3xl font-bold tabular-nums">{llevaTexto}</p>
          </>
        ) : ultima ? (
          <p className="mt-1 text-lg font-semibold">Saliste a las {horaBogota(ultima.marcada_en)}</p>
        ) : (
          <p className="mt-1 text-lg font-semibold">Todavía no has marcado hoy</p>
        )}
      </div>

      {paso === "nada" || paso === "preparando" ? (
        <>
          <Button
            type="button"
            disabled={paso === "preparando"}
            onClick={() => empezar(sugerido)}
            className={cn(
              "h-24 w-full flex-col gap-1.5 rounded-2xl text-lg font-semibold shadow-lg",
              sugerido === "salida" && "bg-emerald-600 text-white hover:bg-emerald-700"
            )}
          >
            {paso === "preparando" && tipo === sugerido ? (
              <Loader2 className="h-7 w-7 animate-spin" />
            ) : sugerido === "entrada" ? (
              <LogIn className="h-7 w-7" />
            ) : (
              <LogOut className="h-7 w-7" />
            )}
            {sugerido === "entrada" ? "Marcar llegada" : "Marcar salida"}
          </Button>
          <Button
            type="button"
            variant="ghost"
            disabled={paso === "preparando"}
            onClick={() => empezar(otro)}
            className="h-10 w-full text-sm text-muted-foreground"
          >
            {otro === "entrada" ? "¿Volviste a llegar? Marcar llegada" : "Marcar salida"}
          </Button>
          {paso === "preparando" && (
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <MapPin className="h-4 w-4" /> Leyendo la ubicación y preparando la foto…
            </p>
          )}
        </>
      ) : (
        preview && (
          <div className="space-y-3">
            <img src={preview.url} alt="Foto de la marca" className="mx-auto max-h-[55vh] rounded-lg border border-border" />
            <div className="grid gap-2 sm:grid-cols-2">
              <Button type="button" variant="outline" className="order-2 h-12 sm:order-1" disabled={paso === "guardando"} onClick={() => { descartar(); if (tipo) empezar(tipo); }}>
                <RotateCcw className="mr-2 h-4 w-4" /> Repetir foto
              </Button>
              <Button type="button" className="order-1 h-14 text-base sm:order-2 sm:h-12" disabled={paso === "guardando"} onClick={() => void confirmar()}>
                {paso === "guardando" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Check className="mr-2 h-4 w-4" />}
                Confirmar {tipo === "entrada" ? "llegada" : "salida"}
              </Button>
            </div>
            <Button type="button" variant="ghost" className="w-full" disabled={paso === "guardando"} onClick={descartar}>
              Cancelar
            </Button>
          </div>
        )
      )}

      {hoy.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {[...hoy].reverse().map((m) => (
            <span
              key={m.id}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm",
                m.tipo === "entrada" ? "bg-primary/10" : "bg-emerald-500/10 text-emerald-800"
              )}
            >
              {m.tipo === "entrada" ? <LogIn className="h-3.5 w-3.5" /> : <LogOut className="h-3.5 w-3.5" />}
              {m.tipo === "entrada" ? "Llegada" : "Salida"} {horaBogota(m.marcada_en)}
            </span>
          ))}
        </div>
      )}
      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Camera className="h-3.5 w-3.5 shrink-0" /> Foto en vivo con hora y ubicación. La primera vez se pide permiso de cámara y ubicación.
      </p>
    </div>
  );
}
