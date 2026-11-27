import { useCallback, useEffect, useRef, useState } from "react";
import { Camera, Loader2, LogIn, LogOut, MapPin, RotateCcw, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { diaBogota, fechaLarga, horaBogota, Marcacion, TipoMarca } from "@/lib/marcaciones";

/**
 * Marcar llegada o salida: foto + hora + ubicacion.
 *
 * Al tocar el boton se pide la ubicacion y se abre la camara al mismo tiempo.
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

async function cargarImagen(archivo: File): Promise<HTMLImageElement> {
  const url = URL.createObjectURL(archivo);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    return img;
  } finally {
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  }
}

/** Dibuja la foto con la franja de datos abajo y devuelve un JPEG. */
async function estampar(archivo: File, lineas: string[]): Promise<Blob> {
  const img = await cargarImagen(archivo);
  const max = 1280;
  const escala = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
  const w = Math.round(img.naturalWidth * escala);
  const h = Math.round(img.naturalHeight * escala);
  const fuente = Math.max(14, Math.round(w / 34));
  const alto = Math.round(fuente * 1.45 * lineas.length + fuente * 1.2);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h + alto;
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(img, 0, 0, w, h);
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
  const inputRef = useRef<HTMLInputElement>(null);
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

  const empezar = (t: TipoMarca) => {
    setTipo(t);
    // La ubicacion se pide ya, mientras la persona toma la foto.
    ubicacionRef.current = pedirUbicacion();
    ubicacionRef.current.catch(() => undefined);
    if (inputRef.current) {
      inputRef.current.value = "";
      inputRef.current.click();
    }
  };

  const alElegirFoto = async (archivo?: File) => {
    if (!archivo || !tipo) return;
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
      const blob = await estampar(archivo, lineas);
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
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="user"
        className="hidden"
        onChange={(e) => void alElegirFoto(e.target.files?.[0])}
      />

      <div>
        <h2 className="text-base font-semibold">Marcar llegada y salida</h2>
        <p className="text-sm text-muted-foreground">
          Toma una foto al llegar y otra al salir. Queda con la hora, la ubicación y la dirección.
        </p>
      </div>

      {paso === "nada" || paso === "preparando" ? (
        <>
          <div className="grid grid-cols-2 gap-3">
            {(["entrada", "salida"] as TipoMarca[]).map((t) => (
              <Button
                key={t}
                type="button"
                variant={sugerido === t ? "default" : "outline"}
                disabled={paso === "preparando"}
                onClick={() => empezar(t)}
                className={cn("h-20 flex-col gap-1 text-base", sugerido === t && "shadow-md")}
              >
                {paso === "preparando" && tipo === t ? (
                  <Loader2 className="h-6 w-6 animate-spin" />
                ) : t === "entrada" ? (
                  <LogIn className="h-6 w-6" />
                ) : (
                  <LogOut className="h-6 w-6" />
                )}
                {t === "entrada" ? "Marcar llegada" : "Marcar salida"}
              </Button>
            ))}
          </div>
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
            <div className="grid grid-cols-2 gap-3">
              <Button type="button" variant="outline" className="h-12" disabled={paso === "guardando"} onClick={() => { descartar(); if (tipo) empezar(tipo); }}>
                <RotateCcw className="mr-2 h-4 w-4" /> Repetir foto
              </Button>
              <Button type="button" className="h-12" disabled={paso === "guardando"} onClick={() => void confirmar()}>
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

      <div className="rounded-lg bg-muted/40 px-3 py-2 text-sm">
        <span className="font-medium">Hoy: </span>
        {hoy.length === 0 ? (
          <span className="text-muted-foreground">todavía no has marcado.</span>
        ) : (
          [...hoy]
            .reverse()
            .map((m) => `${m.tipo === "entrada" ? "llegada" : "salida"} ${horaBogota(m.marcada_en)}`)
            .join(" · ")
        )}
      </div>
      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Camera className="h-3.5 w-3.5" /> En el celular se abre la cámara. El planner pide permiso de ubicación la primera vez.
      </p>
    </div>
  );
}
