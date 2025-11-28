import Layout from "@/components/Layout";
import { PanelHeader } from "@/components/PanelHeader";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Bot, Zap, BarChart3, Users, Package, FileText, Settings, Plus } from "lucide-react";

const agents = [
  {
    id: "1",
    name: "Analizador de Carga",
    description: "Analiza la carga de trabajo y recomienda distribución de recursos",
    icon: BarChart3,
    status: "activo",
    capabilities: ["Análisis SSOT", "Distribución de recursos", "Reportes automáticos"],
  },
  {
    id: "2",
    name: "Evaluador de Proveedores",
    description: "Evalúa proveedores basado en histórico de cotizaciones y rendimiento",
    icon: Users,
    status: "inactivo",
    capabilities: ["Comparación de precios", "Evaluación de calidad", "Recomendaciones"],
  },
  {
    id: "3",
    name: "Gestor de Inventario",
    description: "Optimiza inventario y anticipa necesidades de materiales",
    icon: Package,
    status: "activo",
    capabilities: ["Control de stock", "Alertas de escasez", "Predicción de demanda"],
  },
  {
    id: "4",
    name: "Generador de Reportes",
    description: "Genera reportes semanales automáticos del estado de proyectos",
    icon: FileText,
    status: "inactivo",
    capabilities: ["Reportes PDF", "Envío por email", "Resúmenes ejecutivos"],
  },
];

const AgentesIA = () => {
  return (
    <Layout>
      <div className="space-y-6">
        <PanelHeader
          title="Agentes de IA"
          description="Configura y gestiona agentes de inteligencia artificial"
          actions={
            <Button size="sm">
              <Plus className="h-4 w-4 mr-2" />
              Conectar Agente
            </Button>
          }
        />

        {/* API Key Configuration */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Settings className="h-4 w-4" />
              Configuración de API
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-end gap-4">
              <div className="flex-1 space-y-2">
                <Label>API Key</Label>
                <Input type="password" placeholder="sk-..." className="font-mono" />
              </div>
              <Button variant="outline">Validar</Button>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Conecta tu API key para habilitar los agentes de IA
            </p>
          </CardContent>
        </Card>

        {/* Agents Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {agents.map((agent) => (
            <Card key={agent.id} className="relative overflow-hidden">
              <div
                className={`absolute top-0 left-0 w-1 h-full ${
                  agent.status === "activo" ? "bg-status-active" : "bg-muted"
                }`}
              />
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-primary/10">
                      <agent.icon className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <CardTitle className="text-base">{agent.name}</CardTitle>
                      <Badge
                        variant={agent.status === "activo" ? "default" : "secondary"}
                        className="mt-1 text-[10px]"
                      >
                        {agent.status}
                      </Badge>
                    </div>
                  </div>
                  <Switch checked={agent.status === "activo"} />
                </div>
              </CardHeader>
              <CardContent>
                <CardDescription className="text-xs mb-3">
                  {agent.description}
                </CardDescription>
                <div className="flex flex-wrap gap-1">
                  {agent.capabilities.map((cap) => (
                    <span
                      key={cap}
                      className="text-[10px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground"
                    >
                      {cap}
                    </span>
                  ))}
                </div>
                <div className="flex gap-2 mt-4">
                  <Button variant="outline" size="sm" className="text-xs h-7">
                    <Settings className="h-3 w-3 mr-1" />
                    Configurar
                  </Button>
                  <Button variant="ghost" size="sm" className="text-xs h-7">
                    <Zap className="h-3 w-3 mr-1" />
                    Ejecutar
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Info Card */}
        <Card className="bg-primary/5 border-primary/20">
          <CardContent className="py-4">
            <div className="flex items-start gap-3">
              <Bot className="h-5 w-5 text-primary mt-0.5" />
              <div>
                <h4 className="font-medium text-sm">Funciones de los Agentes IA</h4>
                <ul className="text-xs text-muted-foreground mt-2 space-y-1 list-disc list-inside">
                  <li>Leer y analizar datos SSOT en tiempo real</li>
                  <li>Analizar inventarios y carga de trabajo</li>
                  <li>Recomendar distribución de recursos</li>
                  <li>Evaluar proveedores basado en histórico</li>
                  <li>Enviar reportes semanales automáticos</li>
                  <li>Automatizar tareas operativas repetitivas</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
};

export default AgentesIA;
