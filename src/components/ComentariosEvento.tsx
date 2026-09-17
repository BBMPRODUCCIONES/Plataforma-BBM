import { useCallback, useEffect, useState } from "react";
import { formatDistanceToNow, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { Loader2, MessageSquare, Send, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useUserRole } from "@/hooks/useUserRole";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

interface Comentario {
  id: string;
  autor_id: string | null;
  autor_nombre: string;
  texto: string;
  created_at: string;
}

interface ComentariosEventoProps {
  proyectoId: string;
  /** El dialogo esta abierto. Sin esto se cargarian comentarios sin necesidad. */
  activo: boolean;
}

/** "hace 3 horas". Si la fecha viene rara, se devuelve tal cual. */
function haceCuanto(iso: string): string {
  try {
    return formatDistanceToNow(parseISO(iso), { addSuffix: true, locale: es });
  } catch {
    return iso;
  }
}

/**
 * Comentarios del equipo sobre un evento.
 *
 * Los escribe cualquiera que entre a la plataforma y quedan firmados con el
 * nombre de quien los escribio. No hay permisos por rol aqui a proposito: el
 * punto es que el tecnico que esta en el montaje pueda dejar dicho lo que vio,
 * y eso no funciona si primero hay que pedirle permiso a alguien.
 *
 * Cada comentario es una fila propia en project_comments. Guardarlos en un
 * arreglo dentro del evento haria que dos personas escribiendo al tiempo se
 * pisaran, y el que llegara segundo borraria al primero sin avisar.
 */
export function ComentariosEvento({ proyectoId, activo }: ComentariosEventoProps) {
  const { user } = useAuth();
  const { role } = useUserRole();
  const esAdmin = role === "administrador";

  const [comentarios, setComentarios] = useState<Comentario[]>([]);
  const [cargando, setCargando] = useState(true);
  const [texto, setTexto] = useState("");
  const [enviando, setEnviando] = useState(false);

  const cargar = useCallback(async () => {
    setCargando(true);
    const { data, error } = await supabase
      .from("project_comments")
      .select("id, autor_id, autor_nombre, texto, created_at")
      .eq("project_id", proyectoId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("[ComentariosEvento] No se pudieron leer:", error);
      toast({
        title: "No se pudieron cargar los comentarios",
        description: error.message,
        variant: "destructive",
      });
    } else {
      setComentarios((data as Comentario[]) || []);
    }
    setCargando(false);
  }, [proyectoId]);

  useEffect(() => {
    if (activo && proyectoId) void cargar();
  }, [activo, proyectoId, cargar]);

  /** El nombre con el que se firma: el del perfil, y si no hay, el correo. */
  const nombreDelAutor = useCallback(async (): Promise<string> => {
    if (!user) return "Alguien";
    const { data } = await supabase
      .from("profiles")
      .select("full_name")
      .eq("id", user.id)
      .maybeSingle();
    const nombre = (data?.full_name || "").trim();
    return nombre || user.email || "Alguien";
  }, [user]);

  const enviar = async () => {
    const limpio = texto.trim();
    if (!limpio || !user) return;

    setEnviando(true);
    const autor_nombre = await nombreDelAutor();

    const { data, error } = await supabase
      .from("project_comments")
      .insert({
        project_id: proyectoId,
        autor_id: user.id,
        autor_nombre,
        texto: limpio,
      })
      .select("id, autor_id, autor_nombre, texto, created_at")
      .single();

    if (error) {
      console.error("[ComentariosEvento] No se pudo guardar:", error);
      toast({
        title: "No se pudo guardar el comentario",
        description: error.message,
        variant: "destructive",
      });
    } else {
      // Se agrega el que devolvio la base, no el que se escribio: asi la fecha
      // y el id son los de verdad y no hay que recargar la lista entera.
      setComentarios((prev) => [data as Comentario, ...prev]);
      setTexto("");
    }
    setEnviando(false);
  };

  const borrar = async (id: string) => {
    const { error } = await supabase.from("project_comments").delete().eq("id", id).select();
    if (error) {
      toast({
        title: "No se pudo borrar",
        description: error.message,
        variant: "destructive",
      });
      return;
    }
    setComentarios((prev) => prev.filter((c) => c.id !== id));
  };

  return (
    <div className="w-full min-w-0 space-y-3">
      <div className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        <MessageSquare className="h-3.5 w-3.5" />
        Comentarios
        {comentarios.length > 0 && (
          <span className="tabular-nums">({comentarios.length})</span>
        )}
      </div>

      {user ? (
        <div className="space-y-2">
          <Textarea
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            rows={2}
            placeholder="Escribe algo del evento: una novedad, un acuerdo con el cliente, algo que hay que tener en cuenta…"
            className="resize-y text-sm"
            // Ctrl+Enter envia: el que esta en montaje escribe con una mano.
            onKeyDown={(e) => {
              if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
                e.preventDefault();
                void enviar();
              }
            }}
          />
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] text-muted-foreground">
              Queda firmado con tu nombre. Ctrl + Enter para enviar.
            </span>
            <Button size="sm" onClick={enviar} disabled={enviando || !texto.trim()}>
              {enviando ? (
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
              ) : (
                <Send className="mr-1.5 h-3.5 w-3.5" />
              )}
              Comentar
            </Button>
          </div>
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">
          Inicia sesión para comentar.
        </p>
      )}

      {cargando ? (
        <p className="py-3 text-xs text-muted-foreground">Cargando comentarios…</p>
      ) : comentarios.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border p-4 text-center text-xs text-muted-foreground">
          Todavía nadie ha comentado este evento.
        </p>
      ) : (
        <ul className="max-h-64 space-y-2 overflow-y-auto">
          {comentarios.map((c) => {
            const esMio = Boolean(user && c.autor_id === user.id);
            return (
              <li
                key={c.id}
                className={cn(
                  "rounded-lg border border-border p-3",
                  esMio && "border-foreground/25"
                )}
              >
                <div className="flex items-baseline justify-between gap-2">
                  <span className="min-w-0 truncate text-xs font-semibold">
                    {c.autor_nombre}
                    {esMio && (
                      <span className="ml-1 font-normal text-muted-foreground">(tú)</span>
                    )}
                  </span>
                  <span className="shrink-0 text-[11px] text-muted-foreground">
                    {haceCuanto(c.created_at)}
                  </span>
                </div>
                <p className="mt-1 whitespace-pre-wrap text-sm">{c.texto}</p>
                {(esMio || esAdmin) && (
                  <button
                    type="button"
                    onClick={() => borrar(c.id)}
                    className="mt-1.5 inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 className="h-3 w-3" />
                    Borrar
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

export default ComentariosEvento;
