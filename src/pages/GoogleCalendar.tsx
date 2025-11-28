import Layout from "@/components/Layout";
import { PanelHeader } from "@/components/PanelHeader";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { mockProjects } from "@/data/mockData";
import { Calendar, CheckCircle2, AlertCircle, RefreshCw, Upload, Eye } from "lucide-react";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { useState } from "react";

const GoogleCalendar = () => {
  const [selectedProjects, setSelectedProjects] = useState<string[]>([]);
  const [syncOptions, setSyncOptions] = useState({
    montaje: true,
    ejecucion: true,
  });

  const toggleProject = (id: string) => {
    if (selectedProjects.includes(id)) {
      setSelectedProjects(selectedProjects.filter((p) => p !== id));
    } else {
      setSelectedProjects([...selectedProjects, id]);
    }
  };

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
              <Badge variant="outline" className="text-xs">
                <AlertCircle className="h-3 w-3 mr-1" />
                No conectado
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <Button>
              Conectar con Google Calendar
            </Button>
            <p className="text-xs text-muted-foreground mt-2">
              Autoriza el acceso a tu calendario para sincronizar eventos
            </p>
          </CardContent>
        </Card>

        {/* Sync Options */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Opciones de Sincronización</CardTitle>
            <CardDescription className="text-xs">
              Selecciona qué fechas sincronizar con Google Calendar
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-2">
                <Checkbox
                  checked={syncOptions.montaje}
                  onCheckedChange={(v) => setSyncOptions({ ...syncOptions, montaje: !!v })}
                />
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded bg-gantt-montaje" />
                  <Label className="text-sm">Fechas de Montaje</Label>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox
                  checked={syncOptions.ejecucion}
                  onCheckedChange={(v) => setSyncOptions({ ...syncOptions, ejecucion: !!v })}
                />
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded bg-gantt-ejecucion" />
                  <Label className="text-sm">Fechas de Ejecución</Label>
                </div>
              </div>
            </div>

            <div className="flex gap-2">
              <Button variant="outline" size="sm">
                <Upload className="h-4 w-4 mr-2" />
                Sincronizar Todo el Gantt
              </Button>
              <Button variant="outline" size="sm">
                <RefreshCw className="h-4 w-4 mr-2" />
                Actualizar Sincronización
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Project Selection */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Seleccionar Proyectos</CardTitle>
            <CardDescription className="text-xs">
              Elige qué proyectos sincronizar individualmente
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {mockProjects.map((project) => (
                <div
                  key={project.id}
                  className="flex items-center justify-between p-3 rounded-lg border border-border hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <Checkbox
                      checked={selectedProjects.includes(project.id)}
                      onCheckedChange={() => toggleProject(project.id)}
                    />
                    <div>
                      <span className="font-medium text-sm">{project.evento}</span>
                      <div className="text-xs text-muted-foreground">{project.cliente}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 text-xs">
                    <div className="flex items-center gap-1">
                      <div className="w-2 h-2 rounded bg-gantt-montaje" />
                      {format(parseISO(project.fechaMontajeInicio), "dd MMM", { locale: es })}
                    </div>
                    <div className="flex items-center gap-1">
                      <div className="w-2 h-2 rounded bg-gantt-ejecucion" />
                      {format(parseISO(project.fechaEjecucionInicio), "dd MMM", { locale: es })}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {selectedProjects.length > 0 && (
              <Button className="mt-4">
                Sincronizar {selectedProjects.length} proyecto(s) seleccionado(s)
              </Button>
            )}
          </CardContent>
        </Card>

        {/* Sync Policy Info */}
        <Card className="bg-muted/50">
          <CardContent className="py-4">
            <div className="flex items-start gap-3">
              <Eye className="h-5 w-5 text-muted-foreground mt-0.5" />
              <div>
                <h4 className="font-medium text-sm">Política de Sincronización</h4>
                <ul className="text-xs text-muted-foreground mt-2 space-y-1">
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="h-3 w-3 text-status-active" />
                    Plataforma → Google Calendar: Actualiza y agrega eventos
                  </li>
                  <li className="flex items-center gap-2">
                    <AlertCircle className="h-3 w-3 text-status-pending" />
                    Google Calendar → Plataforma: Solo lectura
                  </li>
                  <li className="text-destructive mt-1">
                    ❗ Los cambios en Google Calendar NO modifican el SSOT
                  </li>
                  <li className="text-destructive">
                    ❗ Las fechas de montaje y ejecución solo se editan desde la plataforma
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
