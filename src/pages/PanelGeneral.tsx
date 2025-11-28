import { useState } from "react";
import { useNavigate } from "react-router-dom";
import Layout from "@/components/Layout";
import { PanelHeader } from "@/components/PanelHeader";
import { MatrixTable } from "@/components/MatrixTable";
import { StatusBadge } from "@/components/StatusBadge";
import { GanttChart } from "@/components/GanttChart";
import { mockProjects } from "@/data/mockData";
import { Project } from "@/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Search, ExternalLink } from "lucide-react";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";

const PanelGeneral = () => {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("todos");

  const filteredProjects = mockProjects.filter((p) => {
    const matchesSearch =
      p.cliente.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.evento.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.centroCostos.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === "todos" || p.estado === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const columns = [
    {
      key: "centroCostos",
      header: "Centro de Costos",
      width: "130px",
      render: (p: Project) => (
        <span className="font-mono text-xs bg-muted px-2 py-1 rounded">
          {p.centroCostos}
        </span>
      ),
    },
    {
      key: "numFactura",
      header: "#Factura",
      width: "100px",
      render: (p: Project) => (
        <span className="font-mono text-xs">{p.numFactura}</span>
      ),
    },
    {
      key: "cliente",
      header: "Cliente",
      width: "200px",
      render: (p: Project) => (
        <div>
          <span className="font-medium text-xs">{p.cliente}</span>
          <div className="text-[10px] text-muted-foreground truncate max-w-[180px]">
            {p.evento}
          </div>
        </div>
      ),
    },
    {
      key: "fechaMontaje",
      header: "Montaje",
      width: "130px",
      render: (p: Project) => (
        <div className="text-xs space-y-0.5">
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-sm bg-gantt-montaje" />
            {format(parseISO(p.fechaMontajeInicio), "dd/MM", { locale: es })}
          </div>
          <div className="text-muted-foreground pl-3">
            → {format(parseISO(p.fechaMontajeFin), "dd/MM", { locale: es })}
          </div>
        </div>
      ),
    },
    {
      key: "fechaEjecucion",
      header: "Ejecución",
      width: "130px",
      render: (p: Project) => (
        <div className="text-xs space-y-0.5">
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-sm bg-gantt-ejecucion" />
            {format(parseISO(p.fechaEjecucionInicio), "dd/MM", { locale: es })}
          </div>
          <div className="text-muted-foreground pl-3">
            → {format(parseISO(p.fechaEjecucionFin), "dd/MM", { locale: es })}
          </div>
        </div>
      ),
    },
    {
      key: "estado",
      header: "Estado",
      width: "110px",
      render: (p: Project) => <StatusBadge status={p.estado} />,
    },
    {
      key: "acciones",
      header: "Paneles",
      width: "180px",
      render: (p: Project) => (
        <div className="flex gap-1">
          <Button
            variant="outline"
            size="sm"
            className="h-6 px-2 text-[10px]"
            onClick={(e) => {
              e.stopPropagation();
              navigate(`/panel-directivo?proyecto=${p.id}`);
            }}
          >
            Directivo
            <ExternalLink className="h-2.5 w-2.5 ml-1" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-6 px-2 text-[10px]"
            onClick={(e) => {
              e.stopPropagation();
              navigate(`/panel-operaciones?proyecto=${p.id}`);
            }}
          >
            Operaciones
            <ExternalLink className="h-2.5 w-2.5 ml-1" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-6 px-2 text-[10px]"
            onClick={(e) => {
              e.stopPropagation();
              navigate("/proveedores");
            }}
          >
            Proveedores
            <ExternalLink className="h-2.5 w-2.5 ml-1" />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <Layout>
      <div className="space-y-6">
        <PanelHeader
          title="Panel General"
          description="Vista general de proyectos y variables SSOT"
          panelLinks={[
            { label: "Directivo", to: "/panel-directivo" },
            { label: "Operaciones", to: "/panel-operaciones" },
          ]}
        />

        <Tabs defaultValue="matriz" className="space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <TabsList>
              <TabsTrigger value="matriz">Matriz</TabsTrigger>
              <TabsTrigger value="gantt">Gantt</TabsTrigger>
            </TabsList>

            <div className="flex items-center gap-3">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-32 h-9">
                  <SelectValue placeholder="Estado" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  <SelectItem value="activo">Activo</SelectItem>
                  <SelectItem value="pendiente">Pendiente</SelectItem>
                  <SelectItem value="completado">Completado</SelectItem>
                  <SelectItem value="cancelado">Cancelado</SelectItem>
                </SelectContent>
              </Select>

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
          </div>

          <TabsContent value="matriz" className="mt-4">
            <div className="panel-card">
              <MatrixTable data={filteredProjects} columns={columns} />
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
      </div>
    </Layout>
  );
};

export default PanelGeneral;
