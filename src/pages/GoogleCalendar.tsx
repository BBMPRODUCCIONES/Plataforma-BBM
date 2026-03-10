import Layout from "@/components/Layout";
import { PanelHeader } from "@/components/PanelHeader";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useProjects } from "@/contexts/ProjectsContext";
import { Calendar, CheckCircle2, AlertCircle, RefreshCw, Upload, Eye, Loader2, Unlink, Zap } from "lucide-react";
import { format, parseISO, formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

const GoogleCalendar = () => {
  const { projects, loading: projectsLoading } = useProjects();
  const { user } = useAuth();
  const [selectedProjects, setSelectedProjects] = useState<string[]>([]);
  const [syncOptions, setSyncOptions] = useState({
    montaje: true,
    ejecucion: true,
  });
  const [isConnected, setIsConnected] = useState(false);
  const [isCheckingConnection, setIsCheckingConnection] = useState(true);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isDisconnecting, setIsDisconnecting] = useState(false);
  const [lastAutoSync, setLastAutoSync] = useState<string | null>(null);
  const [syncedEventsCount, setSyncedEventsCount] = useState(0);

  useEffect(() => {
    checkConnectionStatus();
    
    const urlParams = new URLSearchParams(window.location.search);
    const success = urlParams.get('success');
    const error = urlParams.get('error');
    
    if (success === 'true') {
      toast.success('¡Conectado exitosamente con Google Calendar!');
      window.history.replaceState({}, '', '/calendar');
      checkConnectionStatus();
    } else if (error) {
      const errorMessages: Record<string, string> = {
        'access_denied': 'Acceso denegado por el usuario',
        'token_exchange_failed': 'Error al intercambiar el token',
        'missing_tokens': 'No se recibieron los tokens necesarios',
        'db_error': 'Error al guardar la conexión',
        'server_error': 'Error del servidor',
        'missing_params': 'Parámetros faltantes en la respuesta',
      };
      toast.error(errorMessages[error] || `Error: ${error}`);
      window.history.replaceState({}, '', '/calendar');
    }
  }, []);

  const checkConnectionStatus = async () => {
    if (!user) {
      setIsCheckingConnection(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('google_calendar_tokens')
        .select('id, expires_at')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) {
        console.error('Error checking connection:', error);
        setIsConnected(false);
      } else {
        setIsConnected(!!data);
        if (data) {
          fetchSyncStatus();
        }
      }
    } catch (err) {
      console.error('Error checking connection:', err);
      setIsConnected(false);
    } finally {
      setIsCheckingConnection(false);
    }
  };

  const fetchSyncStatus = async () => {
    if (!user) return;
    try {
      const { data, error } = await supabase
        .from('google_calendar_events')
        .select('last_synced_at')
        .eq('user_id', user.id)
        .order('last_synced_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!error && data) {
        setLastAutoSync(data.last_synced_at);
      }

      const { count } = await supabase
        .from('google_calendar_events')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id);

      setSyncedEventsCount(count || 0);
    } catch (err) {
      console.error('Error fetching sync status:', err);
    }
  };

  const handleConnect = async () => {
    setIsConnecting(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error('Debes iniciar sesión primero');
        return;
      }

      const { data, error } = await supabase.functions.invoke('google-calendar-auth', {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      if (error) throw error;
      if (data?.authUrl) {
        window.location.href = data.authUrl;
      } else {
        throw new Error('No se recibió la URL de autorización');
      }
    } catch (err) {
      console.error('Error connecting:', err);
      toast.error('Error al conectar con Google Calendar');
    } finally {
      setIsConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    if (!user) return;
    setIsDisconnecting(true);
    try {
      const { error } = await supabase
        .from('google_calendar_tokens')
        .delete()
        .eq('user_id', user.id);

      if (error) throw error;
      setIsConnected(false);
      setLastAutoSync(null);
      setSyncedEventsCount(0);
      toast.success('Desconectado de Google Calendar');
    } catch (err) {
      console.error('Error disconnecting:', err);
      toast.error('Error al desconectar');
    } finally {
      setIsDisconnecting(false);
    }
  };

  const handleSync = async (projectIds: string[]) => {
    if (projectIds.length === 0) {
      toast.error('Selecciona al menos un proyecto');
      return;
    }
    if (!syncOptions.montaje && !syncOptions.ejecucion) {
      toast.error('Selecciona al menos un tipo de fecha para sincronizar');
      return;
    }

    setIsSyncing(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error('Debes iniciar sesión primero');
        return;
      }

      const projectsToSync = projects
        .filter(p => projectIds.includes(p.id))
        .map(p => ({
          id: p.id,
          evento: p.evento,
          cliente: p.cliente,
          ubicacion: p.ubicacion,
          notas: p.notas,
          productor: p.productor,
          jefeOperaciones: p.jefeOperaciones,
          aCargoeDe: p.aCargoDe,
          estado: p.estado,
          personal: p.personal,
          fechaMontajeInicio: p.fechaMontajeInicio,
          fechaMontajeFin: p.fechaMontajeFin,
          horaMontajeInicio: p.horaMontajeInicio,
          horaMontajeFin: p.horaMontajeFin,
          fechaEjecucionInicio: p.fechaEjecucionInicio,
          fechaEjecucionFin: p.fechaEjecucionFin,
          horaEjecucionInicio: p.horaEjecucionInicio,
          horaEjecucionFin: p.horaEjecucionFin,
        }));

      const { data, error } = await supabase.functions.invoke('google-calendar-sync', {
        headers: { Authorization: `Bearer ${session.access_token}` },
        body: { projects: projectsToSync, syncOptions },
      });

      if (error) throw error;
      if (data?.success) {
        toast.success(data.message || 'Proyectos sincronizados exitosamente');
        setSelectedProjects([]);
        fetchSyncStatus();
      } else {
        throw new Error(data?.error || 'Error desconocido');
      }
    } catch (err: unknown) {
      console.error('Error syncing:', err);
      toast.error(err instanceof Error ? err.message : 'Error al sincronizar');
    } finally {
      setIsSyncing(false);
    }
  };

  const handleSyncAll = () => handleSync(projects.map(p => p.id));
  const handleSyncSelected = () => handleSync(selectedProjects);

  const toggleProject = (id: string) => {
    setSelectedProjects(prev =>
      prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]
    );
  };

  const projectsWithDates = projects.filter(
    p => p.fechaMontajeInicio || p.fechaEjecucionInicio
  );

  return (
    <Layout>
      <div className="space-y-6">
        <PanelHeader
          title="Google Calendar"
          description="Sincroniza eventos con tu calendario de Google"
        />

        {/* Connection Status */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                Estado de Conexión
              </CardTitle>
              {isCheckingConnection ? (
                <Badge variant="outline" className="text-xs">
                  <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                  Verificando...
                </Badge>
              ) : isConnected ? (
                <Badge variant="outline" className="text-xs text-status-active border-status-active">
                  <CheckCircle2 className="h-3 w-3 mr-1" />
                  Conectado
                </Badge>
              ) : (
                <Badge variant="outline" className="text-xs">
                  <AlertCircle className="h-3 w-3 mr-1" />
                  No conectado
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {isConnected ? (
              <div className="flex items-center gap-2">
                <Button variant="outline" onClick={handleDisconnect} disabled={isDisconnecting}>
                  {isDisconnecting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Unlink className="h-4 w-4 mr-2" />}
                  Desconectar
                </Button>
                <p className="text-xs text-muted-foreground">Tu cuenta de Google Calendar está vinculada</p>
              </div>
            ) : (
              <>
                <Button onClick={handleConnect} disabled={isConnecting || isCheckingConnection}>
                  {isConnecting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Calendar className="h-4 w-4 mr-2" />}
                  Conectar con Google Calendar
                </Button>
                <p className="text-xs text-muted-foreground mt-2">Autoriza el acceso a tu calendario para sincronizar eventos</p>
              </>
            )}
          </CardContent>
        </Card>

        {/* Auto-Sync Status - Only when connected */}
        {isConnected && (
          <Card className="border-primary/20 bg-primary/5">
            <CardContent className="py-4">
              <div className="flex items-start gap-3">
                <Zap className="h-5 w-5 text-primary mt-0.5" />
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h4 className="font-medium text-sm">Sincronización Automática Activa</h4>
                    <Badge variant="outline" className="text-xs text-status-active border-status-active">
                      <span className="relative flex h-2 w-2 mr-1">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-status-active opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-status-active"></span>
                      </span>
                      Activa
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Los proyectos se sincronizan automáticamente cada minuto. Solo se actualizan los eventos que han cambiado.
                  </p>
                  <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                    {lastAutoSync && (
                      <span>
                        🕐 Última sincronización: {formatDistanceToNow(new Date(lastAutoSync), { addSuffix: true, locale: es })}
                      </span>
                    )}
                    <span>📊 {syncedEventsCount} evento(s) sincronizado(s)</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Sync Options - Only show when connected */}
        {isConnected && (
          <>
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Sincronización Manual</CardTitle>
                <CardDescription className="text-xs">
                  Fuerza la sincronización inmediata de proyectos específicos
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-6">
                  <div className="flex items-center gap-2">
                    <Checkbox checked={syncOptions.montaje} onCheckedChange={(v) => setSyncOptions({ ...syncOptions, montaje: !!v })} />
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded bg-gantt-montaje" />
                      <Label className="text-sm">Fechas de Montaje</Label>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Checkbox checked={syncOptions.ejecucion} onCheckedChange={(v) => setSyncOptions({ ...syncOptions, ejecucion: !!v })} />
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded bg-gantt-ejecucion" />
                      <Label className="text-sm">Fechas de Ejecución</Label>
                    </div>
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={handleSyncAll} disabled={isSyncing || projectsWithDates.length === 0}>
                    {isSyncing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Upload className="h-4 w-4 mr-2" />}
                    Sincronizar Todo ({projectsWithDates.length})
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Project Selection */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Seleccionar Proyectos</CardTitle>
                <CardDescription className="text-xs">Elige qué proyectos sincronizar manualmente</CardDescription>
              </CardHeader>
              <CardContent>
                {projectsLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : projectsWithDates.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground text-sm">No hay proyectos con fechas configuradas</div>
                ) : (
                  <div className="space-y-2">
                    {projectsWithDates.map((project) => (
                      <div key={project.id} className="flex items-center justify-between p-3 rounded-lg border border-border hover:bg-muted/50 transition-colors">
                        <div className="flex items-center gap-3">
                          <Checkbox checked={selectedProjects.includes(project.id)} onCheckedChange={() => toggleProject(project.id)} />
                          <div>
                            <span className="font-medium text-sm">{project.evento || 'Sin nombre'}</span>
                            <div className="text-xs text-muted-foreground">{project.cliente || 'Sin cliente'}</div>
                          </div>
                        </div>
                        <div className="flex items-center gap-4 text-xs">
                          {project.fechaMontajeInicio && (
                            <div className="flex items-center gap-1">
                              <div className="w-2 h-2 rounded bg-gantt-montaje" />
                              {format(parseISO(project.fechaMontajeInicio), "dd MMM", { locale: es })}
                            </div>
                          )}
                          {project.fechaEjecucionInicio && (
                            <div className="flex items-center gap-1">
                              <div className="w-2 h-2 rounded bg-gantt-ejecucion" />
                              {format(parseISO(project.fechaEjecucionInicio), "dd MMM", { locale: es })}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {selectedProjects.length > 0 && (
                  <Button className="mt-4" onClick={handleSyncSelected} disabled={isSyncing}>
                    {isSyncing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}
                    Sincronizar {selectedProjects.length} proyecto(s)
                  </Button>
                )}
              </CardContent>
            </Card>
          </>
        )}

        {/* Sync Policy Info */}
        <Card className="bg-muted/50">
          <CardContent className="py-4">
            <div className="flex items-start gap-3">
              <Eye className="h-5 w-5 text-muted-foreground mt-0.5" />
              <div>
                <h4 className="font-medium text-sm">Política de Sincronización</h4>
                <ul className="text-xs text-muted-foreground mt-2 space-y-1">
                  <li className="flex items-center gap-2">
                    <Zap className="h-3 w-3 text-primary" />
                    Sincronización automática cada minuto (solo cambios)
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="h-3 w-3 text-status-active" />
                    Plataforma → Google Calendar: Crea y actualiza eventos
                  </li>
                  <li className="flex items-center gap-2">
                    <AlertCircle className="h-3 w-3 text-status-pending" />
                    Google Calendar → Plataforma: Solo lectura
                  </li>
                  <li className="text-destructive mt-1">
                    ❗ Los cambios en Google Calendar NO modifican el SSOT
                  </li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
};

export default GoogleCalendar;
