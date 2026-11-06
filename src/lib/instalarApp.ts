/**
 * Instalar el planner como app en el celular.
 *
 * Chrome en Android avisa UNA sola vez, con el evento `beforeinstallprompt`,
 * que la pagina se puede instalar, y lo hace apenas carga. Si en ese momento
 * no hay ningun componente escuchando (por ejemplo, el usuario ya tenia sesion
 * y nunca paso por la pantalla de entrada), el aviso se pierde y el boton
 * nunca aparece. Por eso se captura aqui, al cargar el modulo, y se guarda.
 *
 * En iPhone ese evento no existe: Safari solo permite instalar desde
 * Compartir -> Agregar a pantalla de inicio, asi que alli se muestran los pasos.
 */

export interface EventoInstalar extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

let pendiente: EventoInstalar | null = null;
const oyentes = new Set<() => void>();
const avisar = () => oyentes.forEach((f) => f());

if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    pendiente = e as EventoInstalar;
    avisar();
  });
  window.addEventListener("appinstalled", () => {
    pendiente = null;
    avisar();
  });
}

export function suscribirInstalacion(f: () => void): () => void {
  oyentes.add(f);
  return () => oyentes.delete(f);
}

export function eventoDeInstalacion(): EventoInstalar | null {
  return pendiente;
}

export function estaInstalada(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as unknown as { standalone?: boolean }).standalone === true
  );
}

export function esIOS(): boolean {
  if (typeof navigator === "undefined") return false;
  return (
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    // iPad con iPadOS se presenta como Mac
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
  );
}

/** Abre el dialogo nativo de instalacion. Devuelve true si el usuario acepto. */
export async function instalarDirecto(): Promise<boolean | null> {
  if (!pendiente) return null;
  const e = pendiente;
  await e.prompt();
  const { outcome } = await e.userChoice;
  pendiente = null;
  avisar();
  return outcome === "accepted";
}
