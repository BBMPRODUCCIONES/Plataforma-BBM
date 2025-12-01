import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import Layout from "@/components/Layout";
import { PanelHeader } from "@/components/PanelHeader";
import { MatrixTable } from "@/components/MatrixTable";
import { StatusSelect } from "@/components/StatusSelect";
import { GanttChart } from "@/components/GanttChart";
import { CalendarFilter } from "@/components/CalendarFilter";
import { FileUploadButton } from "@/components/FileUpload";
import { PurchaseOrderUpload } from "@/components/PurchaseOrderUpload";
import { AvanzadaSelect } from "@/components/AvanzadaSelect";
import { DateTimeRangeEditor } from "@/components/DateTimeRangeEditor";
import { EditableCell, CellType } from "@/components/EditableCell";
import { ColumnManagerDialog, ColumnConfig } from "@/components/ColumnManagerDialog";
import { useUserRole } from "@/hooks/useUserRole";
import { mockProjects } from "@/data/mockData";
import { Project, PersonalItem, InventarioItem, ProjectStatus, CalendarViewMode } from "@/types";
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
import { Search, Users, Package, FileText, FileDown, Settings } from "lucide-react";
import { format, parseISO, startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfQuarter, endOfQuarter, startOfYear, endOfYear, isWithinInterval } from "date-fns";
import { es } from "date-fns/locale";
import { printPersonal, printInventario, printCotizaciones } from "@/utils/pdfGenerator";

const PanelOperaciones = () => {
  const navigate = useNavigate();
  const { canEditStructure } = useUserRole();
  const [searchTerm, setSearchTerm] = useState("");
  const [projects, setProjects] = useState<Project[]>(mockProjects);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [highlightedProjectId, setHighlightedProjectId] = useState<string | null>(null);
  const [columnManagerOpen, setColumnManagerOpen] = useState(false);
  const [managedColumns, setManagedColumns] = useState<ColumnConfig[]>([]);
  
  const [viewMode, setViewMode] = useState<CalendarViewMode>("month");
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [dateRange, setDateRange] = useState<{ start: Date; end: Date } | undefined>();
  const [statusFilter, setStatusFilter] = useState<ProjectStatus | "todos">("todos");

  const updateProject = (projectId: string, field: string, value: any) => {
    setProjects(projects.map(proj =>
      proj.id === projectId ? { ...proj, [field]: value } : proj
    ));
  };

  const handleColumnsChange = (newColumns: ColumnConfig[]) => {
    setManagedColumns(newColumns);
  };

  const getDateRange = () => {
    if (viewMode === "custom" && dateRange) {
      return dateRange;
    }
    switch (viewMode) {
      case "day":
        return { start: startOfDay(selectedDate), end: endOfDay(selectedDate) };
      case "week":
        return { start: startOfWeek(selectedDate, { weekStartsOn: 1 }), end: endOfWeek(selectedDate, { weekStartsOn: 1 }) };
      case "month":
        return { start: startOfMonth(selectedDate), end: endOfMonth(selectedDate) };
      case "quarter":
        return { start: startOfQuarter(selectedDate), end: endOfQuarter(selectedDate) };
      case "year":
        return { start: startOfYear(selectedDate), end: endOfYear(selectedDate) };
      default:
        return { start: startOfMonth(selectedDate), end: endOfMonth(selectedDate) };
    }
  };

  const filteredProjects = projects.filter((p) => {
    const matchesSearch =
      p.cliente.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.evento.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.centroCostos.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = statusFilter === "todos" || p.estado === statusFilter;
    
    const range = getDateRange();
    const projectStart = parseISO(p.fechaMontajeInicio);
    const projectEnd = parseISO(p.fechaEjecucionFin);
    const matchesDate = 
      isWithinInterval(projectStart, range) ||
      isWithinInterval(projectEnd, range) ||
      (projectStart <= range.start && projectEnd >= range.end);

    return matchesSearch && matchesStatus && matchesDate;
  });

  const handleGanttProjectClick = (projectId: string) => {
    setHighlightedProjectId(projectId);
    const tabTrigger = document.querySelector('[value="matriz"]') as HTMLElement;
    if (tabTrigger) tabTrigger.click();
  };

  const baseColumns = [
    {
      key: "centroCostos",
      header: "CC",
      width: "100px",
      render: (p: Project) => (
        <EditableCell
          value={p.centroCostos}
          type="text"
          onChange={(value) => updateProject(p.id, "centroCostos", value)}
          className="font-mono"
        />
      ),
    },
    {
      key: "numFactura",
      header: "#Factura",
      width: "80px",
      render: (p: Project) => (
        <EditableCell
          value={p.numFactura}
          type="text"
          onChange={(value) => updateProject(p.id, "numFactura", value)}
          className="font-mono"
        />
      ),
    },
    {
      key: "cliente",
      header: "Cliente",
      width: "150px",
      render: (p: Project) => (
        <EditableCell
          value={p.cliente}
          type="text"
          onChange={(value) => updateProject(p.id, "cliente", value)}
          className="font-medium"
        />
      ),
    },
    {
      key: "avanzada",
      header: "Avanzada",
      width: "130px",
      render: (p: Project) => (
        <AvanzadaSelect
          value={p.avanzada}
          onChange={(value) => updateProject(p.id, "avanzada", value)}
        />
      ),
    },
    {
      key: "fechaMontaje",
      header: "Montaje",
      width: "110px",
      render: (p: Project) => (
        <DateTimeRangeEditor
          type="montaje"
          value={{
            fechaInicio: p.fechaMontajeInicio,
            fechaFin: p.fechaMontajeFin,
            horaInicio: p.horaMontajeInicio,
            horaFin: p.horaMontajeFin,
          }}
          onChange={(value) => {
            setProjects(projects.map(proj =>
              proj.id === p.id
                ? {
                    ...proj,
                    fechaMontajeInicio: value.fechaInicio,
                    fechaMontajeFin: value.fechaFin,
                    horaMontajeInicio: value.horaInicio,
                    horaMontajeFin: value.horaFin,
                  }
                : proj
            ));
          }}
          displayValue={
            <div className="text-xs flex items-center gap-1">
              <div className="w-2 h-2 rounded-sm bg-gantt-montaje" />
              {format(parseISO(p.fechaMontajeInicio), "dd/MM")}
            </div>
          }
        />
      ),
    },
    {
      key: "fechaEjecucion",
      header: "Ejecución",
      width: "110px",
      render: (p: Project) => (
        <DateTimeRangeEditor
          type="ejecucion"
          value={{
            fechaInicio: p.fechaEjecucionInicio,
            fechaFin: p.fechaEjecucionFin,
            horaInicio: p.horaEjecucionInicio,
            horaFin: p.horaEjecucionFin,
          }}
          onChange={(value) => {
            setProjects(projects.map(proj =>
              proj.id === p.id
                ? {
                    ...proj,
                    fechaEjecucionInicio: value.fechaInicio,
                    fechaEjecucionFin: value.fechaFin,
                    horaEjecucionInicio: value.horaInicio,
                    horaEjecucionFin: value.horaFin,
                  }
                : proj
            ));
          }}
          displayValue={
            <div className="text-xs flex items-center gap-1">
              <div className="w-2 h-2 rounded-sm bg-gantt-ejecucion" />
              {format(parseISO(p.fechaEjecucionInicio), "dd/MM")}
            </div>
          }
        />
      ),
    },
    {
      key: "estado",
      header: "Estado",
      width: "130px",
      render: (p: Project) => (
        <StatusSelect
          value={p.estado}
          onChange={(value) => updateProject(p.id, "estado", value)}
        />
      ),
    },
    {
      key: "jefeOperaciones",
      header: "Jefe Ops",
      width: "120px",
      render: (p: Project) => (
        <EditableCell
          value={p.jefeOperaciones}
          type="text"
          onChange={(value) => updateProject(p.id, "jefeOperaciones", value)}
        />
      ),
    },
    {
      key: "aCargoDe",
      header: "A Cargo",
      width: "100px",
      render: (p: Project) => (
        <EditableCell
          value={p.aCargoDe}
          type="text"
          onChange={(value) => updateProject(p.id, "aCargoDe", value)}
        />
      ),
    },
    {
      key: "productor",
      header: "Productor",
      width: "110px",
      render: (p: Project) => (
        <EditableCell
          value={p.productor}
          type="text"
          onChange={(value) => updateProject(p.id, "productor", value)}
        />
      ),
    },
    {
      key: "ubicacion",
      header: "Ubicación",
      width: "150px",
      render: (p: Project) => (
        <EditableCell
          value={p.ubicacion}
          type="text"
          onChange={(value) => updateProject(p.id, "ubicacion", value)}
        />
      ),
    },
    {
      key: "formatoPreproduccion",
      header: "Formato",
      width: "80px",
      render: (p: Project) => (
        <FileUploadButton
          attachments={p.formatoPreproduccion || []}
          onAttachmentsChange={(attachments) => updateProject(p.id, "formatoPreproduccion", attachments)}
          multiple
        />
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
      key: "cotizacionProveedor",
      header: "Cot. Prov",
      width: "80px",
      render: (p: Project) => (
        <FileUploadButton
          attachments={p.cotizacionesProveedor || []}
          onAttachmentsChange={(attachments) => updateProject(p.id, "cotizacionesProveedor", attachments)}
          multiple
        />
      ),
    },
    {
      key: "ordenCompraOCR",
      header: "OC + OCR",
      width: "120px",
      render: (p: Project) => (
        <div className="flex items-center gap-1">
          <FileUploadButton
            attachments={(p as any).ordenesCompra || []}
            onAttachmentsChange={(attachments) => updateProject(p.id, "ordenesCompra", attachments)}
            multiple={false}
          />
          <PurchaseOrderUpload
            currentIngresoBruto={p.ingresoBruto}
            currentIngresoTotal={p.ingresoTotal}
            onDataExtracted={(ingresoBruto, ingresoTotal) => {
              setProjects(projects.map(proj =>
                proj.id === p.id
                  ? {
                      ...proj,
                      ingresoBruto: ingresoBruto ?? proj.ingresoBruto,
                      ingresoTotal: ingresoTotal ?? proj.ingresoTotal,
                    }
                  : proj
              ));
            }}
          />
        </div>
      ),
    },
    {
      key: "notas",
      header: "Notas",
      width: "150px",
      render: (p: Project) => (
        <EditableCell
          value={p.notas}
          type="text"
          onChange={(value) => updateProject(p.id, "notas", value)}
        />
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
      key: "panelGeneral",
      header: "Panel",
      width: "80px",
      render: (p: Project) => (
        <Button
          variant="outline"
          size="sm"
          className="h-6 px-2 text-[10px]"
          onClick={(e) => {
            e.stopPropagation();
            navigate(`/panel-general?proyecto=${p.id}`);
          }}
        >
          General
        </Button>
      ),
    },
  ];

  const columns = [...baseColumns];

  const personalColumns = [
    { key: "nombre", header: "Nombre", width: "150px" },
    { key: "cargo", header: "Cargo", width: "120px" },
    { key: "telefono", header: "Teléfono", width: "130px" },
    { 
      key: "tipoPersonal", 
      header: "Tipo", 
      width: "100px",
      render: (p: PersonalItem) => (
        <span className={`text-xs px-2 py-0.5 rounded ${
          p.tipoPersonal === "BBM" ? "bg-blue-500/20 text-blue-600" :
          p.tipoPersonal === "Externo" ? "bg-orange-500/20 text-orange-600" :
          "bg-green-500/20 text-green-600"
        }`}>
          {p.tipoPersonal}
        </span>
      ),
    },
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
    { key: "notasAdicionales", header: "Notas Adicionales", width: "150px" },
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
          actions={
            canEditStructure() && (
              <Button variant="outline" size="sm" onClick={() => setColumnManagerOpen(true)}>
                <Settings className="h-4 w-4 mr-2" />
                Gestionar Columnas
              </Button>
            )
          }
        />

        <CalendarFilter
          viewMode={viewMode}
          selectedDate={selectedDate}
          dateRange={dateRange}
          statusFilter={statusFilter}
          onViewModeChange={setViewMode}
          onDateChange={setSelectedDate}
          onDateRangeChange={setDateRange}
          onStatusChange={setStatusFilter}
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
                highlightedId={highlightedProjectId}
              />
            </div>
          </TabsContent>

          <TabsContent value="gantt" className="mt-4">
            <GanttChart
              projects={filteredProjects}
              startDate={selectedDate}
              monthsToShow={viewMode === "year" ? 12 : viewMode === "quarter" ? 3 : viewMode === "month" ? 3 : 1}
              viewMode={viewMode}
              customDateRange={dateRange}
              onProjectClick={handleGanttProjectClick}
            />
          </TabsContent>
        </Tabs>

        {/* Project Detail Dialog */}
        <Dialog open={!!selectedProject} onOpenChange={() => setSelectedProject(null)}>
          <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                {selectedProject?.evento}
                {selectedProject && (
                  <StatusSelect
                    value={selectedProject.estado}
                    onChange={(value) => updateProject(selectedProject.id, "estado", value)}
                  />
                )}
              </DialogTitle>
            </DialogHeader>

            {selectedProject && (
              <div className="space-y-6 mt-4">
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

                <Card>
                  <CardHeader className="py-3 flex flex-row items-center justify-between">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Users className="h-4 w-4" />
                      Personal ({selectedProject.personal?.length || 0})
                    </CardTitle>
                    <Button variant="outline" size="sm" onClick={() => printPersonal(selectedProject)}>
                      <FileDown className="h-4 w-4 mr-2" />
                      Generar PDF
                    </Button>
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

                <Card>
                  <CardHeader className="py-3 flex flex-row items-center justify-between">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Package className="h-4 w-4" />
                      Inventario ({selectedProject.inventario?.length || 0})
                    </CardTitle>
                    <Button variant="outline" size="sm" onClick={() => printInventario(selectedProject)}>
                      <FileDown className="h-4 w-4 mr-2" />
                      Generar PDF
                    </Button>
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

                <Card>
                  <CardHeader className="py-3 flex flex-row items-center justify-between">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <FileText className="h-4 w-4" />
                      Cotizaciones Proveedor
                    </CardTitle>
                    <Button variant="outline" size="sm" onClick={() => printCotizaciones(selectedProject)}>
                      <FileDown className="h-4 w-4 mr-2" />
                      Generar PDF
                    </Button>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <p className="text-sm text-muted-foreground">
                      No hay cotizaciones adjuntas
                    </p>
                  </CardContent>
                </Card>

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

        <ColumnManagerDialog
          open={columnManagerOpen}
          onOpenChange={setColumnManagerOpen}
          columns={managedColumns.length > 0 ? managedColumns : []}
          onColumnsChange={handleColumnsChange}
          panelName="Panel Operaciones"
        />
      </div>
    </Layout>
  );
};

export default PanelOperaciones;
