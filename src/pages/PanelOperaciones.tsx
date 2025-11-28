import { useState } from "react";
import { useNavigate } from "react-router-dom";
import Layout from "@/components/Layout";
import { PanelHeader } from "@/components/PanelHeader";
import { MatrixTable } from "@/components/MatrixTable";
import { StatusBadge } from "@/components/StatusBadge";
import { GanttChart } from "@/components/GanttChart";
import { mockProjects } from "@/data/mockData";
import { Project, PersonalItem, InventarioItem } from "@/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Search, Users, Package, FileText, MapPin, User } from "lucide-react";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";

const PanelOperaciones = () => {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);

  const filteredProjects = mockProjects.filter(
    (p) =>
      p.cliente.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.evento.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.centroCostos.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const columns = [
    {
      key: "centroCostos",
      header: "CC",
      width: "100px",
      render: (p: Project) => (
        <span className="font-mono text-xs">{p.centroCostos}</span>
      ),
    },
    {
      key: "numFactura",
      header: "#Factura",
      width: "80px",
      render: (p: Project) => (
        <span className="font-mono text-xs">{p.numFactura}</span>
      ),
    },
    {
      key: "cliente",
      header: "Cliente",
      width: "150px",
      render: (p: Project) => (
        <span className="font-medium text-xs">{p.cliente}</span>
      ),
    },
    {
      key: "fechas",
      header: "Fechas",
      width: "120px",
      render: (p: Project) => (
        <div className="text-xs space-y-0.5">
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-sm bg-gantt-montaje" />
            {format(parseISO(p.fechaMontajeInicio), "dd/MM")}
          </div>
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-sm bg-gantt-ejecucion" />
            {format(parseISO(p.fechaEjecucionInicio), "dd/MM")}
          </div>
        </div>
      ),
    },
    {
      key: "estado",
      header: "Estado",
      width: "90px",
      render: (p: Project) => <StatusBadge status={p.estado} />,
    },
    {
      key: "jefeOperaciones",
      header: "Jefe Ops",
      width: "120px",
      render: (p: Project) => (
        <div className="flex items-center gap-1 text-xs">
          <User className="h-3 w-3 text-muted-foreground" />
          {p.jefeOperaciones || "-"}
        </div>
      ),
    },
    {
      key: "aCargoDe",
      header: "A Cargo",
      width: "100px",
      render: (p: Project) => (
        <span className="text-xs">{p.aCargoDe || "-"}</span>
      ),
    },
    {
      key: "productor",
      header: "Productor",
      width: "110px",
      render: (p: Project) => (
        <span className="text-xs">{p.productor || "-"}</span>
      ),
    },
    {
      key: "ubicacion",
      header: "Ubicación",
      width: "150px",
      render: (p: Project) => (
        <div className="flex items-center gap-1 text-xs">
          <MapPin className="h-3 w-3 text-muted-foreground shrink-0" />
          <span className="truncate">{p.ubicacion || "-"}</span>
        </div>
      ),
    },
    {
      key: "personal",
      header: "Personal",
      width: "80px",
      render: (p: Project) => (
        <Button
          variant="ghost"
          size="sm"
          className="h-6 px-2 text-xs"
          onClick={(e) => {
            e.stopPropagation();
            setSelectedProject(p);
          }}
        >
          <Users className="h-3 w-3 mr-1" />
          {p.personal?.length || 0}
        </Button>
      ),
    },
    {
      key: "inventario",
      header: "Inventario",
      width: "80px",
      render: (p: Project) => (
        <Button
          variant="ghost"
          size="sm"
          className="h-6 px-2 text-xs"
          onClick={(e) => {
            e.stopPropagation();
            setSelectedProject(p);
          }}
        >
          <Package className="h-3 w-3 mr-1" />
          {p.inventario?.length || 0}
        </Button>
      ),
    },
    {
      key: "notas",
      header: "Notas",
      width: "200px",
      render: (p: Project) => (
        <span className="text-xs text-muted-foreground truncate block max-w-[180px]">
          {p.notas || "-"}
        </span>
      ),
    },
  ];

  const personalColumns = [
    { key: "nombre", header: "Nombre", width: "150px" },
    { key: "cargo", header: "Cargo", width: "120px" },
    { key: "telefono", header: "Teléfono", width: "130px" },
    { key: "notas", header: "Notas", width: "200px" },
  ];

  const inventarioColumns = [
    { key: "nombreMaterial", header: "Material", width: "180px" },
    {
      key: "cantidad",
      header: "Cantidad",
      width: "80px",
      render: (i: InventarioItem) => `${i.cantidad} ${i.unidad}`,
    },
    { key: "observaciones", header: "Observaciones", width: "200px" },
    {
      key: "recibido",
      header: "Recibido",
      width: "80px",
      render: (i: InventarioItem) => (
        <Checkbox checked={i.recibido} disabled />
      ),
    },
  ];

  return (
    <Layout>
      <div className="space-y-6">
        <PanelHeader
          title="Panel de Operaciones"
          description="Gestión operativa, personal e inventario"
          panelLinks={[
            { label: "Directivo", to: "/panel-directivo" },
            { label: "General", to: "/panel-general" },
            { label: "Proveedores", to: "/proveedores" },
          ]}
        />

        <Tabs defaultValue="matriz" className="space-y-4">
          <div className="flex items-center justify-between">
            <TabsList>
              <TabsTrigger value="matriz">Matriz Operaciones</TabsTrigger>
              <TabsTrigger value="gantt">Gantt</TabsTrigger>
            </TabsList>

            <div className="relative w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 h-9"
              />
            </div>
          </div>

          <TabsContent value="matriz" className="mt-4">
            <div className="panel-card">
              <MatrixTable
                data={filteredProjects}
                columns={columns}
                onRowClick={(p) => setSelectedProject(p)}
              />
            </div>
          </TabsContent>

          <TabsContent value="gantt" className="mt-4">
            <GanttChart
              projects={filteredProjects}
              startDate={new Date(2024, 2, 1)}
              monthsToShow={3}
            />
          </TabsContent>
        </Tabs>

        {/* Project Detail Dialog */}
        <Dialog open={!!selectedProject} onOpenChange={() => setSelectedProject(null)}>
          <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                {selectedProject?.evento}
                <StatusBadge status={selectedProject?.estado || "pendiente"} />
              </DialogTitle>
            </DialogHeader>

            {selectedProject && (
              <div className="space-y-6 mt-4">
                {/* Project Info */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                    <span className="text-xs text-muted-foreground">Cliente</span>
                    <p className="text-sm font-medium">{selectedProject.cliente}</p>
                  </div>
                  <div>
                    <span className="text-xs text-muted-foreground">Centro Costos</span>
                    <p className="text-sm font-mono">{selectedProject.centroCostos}</p>
                  </div>
                  <div>
                    <span className="text-xs text-muted-foreground">Jefe Operaciones</span>
                    <p className="text-sm">{selectedProject.jefeOperaciones || "-"}</p>
                  </div>
                  <div>
                    <span className="text-xs text-muted-foreground">Ubicación</span>
                    <p className="text-sm">{selectedProject.ubicacion || "-"}</p>
                  </div>
                </div>

                {/* Personal Subtemplate */}
                <Card>
                  <CardHeader className="py-3">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Users className="h-4 w-4" />
                      Personal ({selectedProject.personal?.length || 0})
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-0">
                    {selectedProject.personal && selectedProject.personal.length > 0 ? (
                      <MatrixTable
                        data={selectedProject.personal}
                        columns={personalColumns}
                      />
                    ) : (
                      <p className="text-sm text-muted-foreground">No hay personal asignado</p>
                    )}
                  </CardContent>
                </Card>

                {/* Inventario Subtemplate */}
                <Card>
                  <CardHeader className="py-3">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Package className="h-4 w-4" />
                      Inventario ({selectedProject.inventario?.length || 0})
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-0">
                    {selectedProject.inventario && selectedProject.inventario.length > 0 ? (
                      <MatrixTable
                        data={selectedProject.inventario}
                        columns={inventarioColumns}
                      />
                    ) : (
                      <p className="text-sm text-muted-foreground">No hay inventario registrado</p>
                    )}
                  </CardContent>
                </Card>

                {/* Cotizaciones Proveedor */}
                <Card>
                  <CardHeader className="py-3">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <FileText className="h-4 w-4" />
                      Cotizaciones Proveedor
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <p className="text-sm text-muted-foreground">
                      No hay cotizaciones adjuntas
                    </p>
                  </CardContent>
                </Card>

                {/* Notas */}
                {selectedProject.notas && (
                  <Card>
                    <CardHeader className="py-3">
                      <CardTitle className="text-sm">Notas</CardTitle>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <p className="text-sm">{selectedProject.notas}</p>
                    </CardContent>
                  </Card>
                )}
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
};

export default PanelOperaciones;
