import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { logger } from "@/lib/logger";
import Layout from "@/components/Layout";
import { PanelHeader } from "@/components/PanelHeader";
import { MatrixTable } from "@/components/MatrixTable";
import { ProductorSelect } from "@/components/ProductorSelect";
import { PersonalNominaSelect } from "@/components/PersonalNominaSelect";
import { StatusSelect } from "@/components/StatusSelect";
import { EventCalendar } from "@/components/EventCalendar";
import { CalendarFilter } from "@/components/CalendarFilter";
import { AttachmentButton } from "@/components/AttachmentManager";
import { PurchaseOrderUpload } from "@/components/PurchaseOrderUpload";
import { AvanzadaSelect } from "@/components/AvanzadaSelect";
import { DateTimeRangeEditor } from "@/components/DateTimeRangeEditor";
import { EditableCell, CellType } from "@/components/EditableCell";
import { ClienteAutocomplete } from "@/components/ClienteAutocomplete";
import { ColumnManagerDialog, ColumnConfig } from "@/components/ColumnManagerDialog";
import { EventLink } from "@/components/EventLink";
import { CostosEventoDialog } from "@/components/CostosEventoDialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useGlobalColumns } from "@/hooks/useGlobalColumns";
import { anclarPrimero } from "@/lib/columnasPanel";
import { cn } from "@/lib/utils";
import { coincideBusquedaDeEvento } from "@/lib/busquedaEvento";
import {
  alertaVisiblePara,
  alertaParpadea,
  cuantosSinProductor,
  mesDeEjecucion,
} from "@/lib/alertaCostos";
import { useUsuariosRegistrados } from "@/hooks/useUsuariosRegistrados";
import { useUserRole } from "@/hooks/useUserRole";
import { useProjects } from "@/contexts/ProjectsContext";
import { useDateRange } from "@/contexts/DateRangeContext";
import { Project, ProjectStatus, CalendarViewMode, CostoEvento } from "@/types";
import { acentoVisualDeEvento, estiloFilaVisual } from "@/lib/coloresProyecto";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Search, ExternalLink, Settings, Loader2, Eye, ArrowUpDown, ArrowUp, ArrowDown, Receipt, Paperclip, AlertTriangle } from "lucide-react";
import { format, parseISO, startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfQuarter, endOfQuarter, startOfYear, endOfYear, isWithinInterval } from "date-fns";
import { es } from "date-fns/locale";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/contexts/AuthContext";
import { FiltroProductor, pasaFiltroDeProductor } from "@/components/FiltroProductor";
import { lineasReales, marcadoSinTerceros, totalDeCostos } from "@/lib/costosEvento";

/**
 * Columnas que ya no se muestran en Panel General.
 *
 * Se esconden, no se borran: el dato sigue guardado en cada evento y volver a
 * mostrarlas es sacar la clave de esta lista. Se filtran aqui y no en la
 * configuracion de columnas porque esa configuracion es la misma para todos
 * los usuarios y cualquiera podria devolverlas sin querer.
 */
const COLUMNAS_RETIRADAS = ["avanzada"];


/**
 * Celda de Costos: el total si hay algo cargado, o la invitacion a cargarlo.
 * Es el mismo boton del Panel Directivo. Se repite aqui a proposito en vez de
 * importarlo: el Directivo es una pagina de mil lineas y sacarle piezas ahora
 * es un cambio grande para una tanda que solo agrega una columna.
 */
const BotonCostos = ({
  proyecto,
  onAbrir,
  enAlerta = false,
  parpadea = false,
}: {
  proyecto: Project;
  onAbrir: (id: string) => void;
  /** El evento ya se ejecuto y sigue sin costos. Ver lib/alertaCostos. */
  enAlerta?: boolean;
  /** Ademas es un evento del que esta mirando: se mueve para que lo vea. */
  parpadea?: boolean;
}) => {
  const lineas = lineasReales(proyecto.costos);
  const total = totalDeCostos(proyecto.costos);
  const sinTerceros = marcadoSinTerceros(proyecto.costos);
  const soportes = (proyecto.costosAdjuntos || []).length;
  return (
    <Button
      variant="ghost"
      size="sm"
      className={
        enAlerta
          ? cn(
              "h-7 w-full justify-start px-1.5 text-xs bg-destructive/10 font-medium text-destructive ring-1 ring-inset ring-destructive/40 hover:bg-destructive/20",
              parpadea && "animate-pulse ring-destructive"
            )
          : "h-7 w-full justify-start px-1.5 text-xs"
      }
      onClick={(e) => {
        e.stopPropagation();
        onAbrir(proyecto.id);
      }}
      title={
        [
          parpadea
            ? "Eres el productor de este evento: ya se ejecuto y no tiene costos cargados"
            : enAlerta
              ? "Este evento ya se ejecuto y no tiene costos cargados"
              : "",
          sinTerceros
            ? "Marcado: el evento no tuvo costos de terceros"
            : lineas.length > 0
              ? `${lineas.length} costo${lineas.length === 1 ? "" : "s"} cargado${lineas.length === 1 ? "" : "s"}`
              : "Cargar los costos del evento",
          soportes > 0 ? `${soportes} soporte${soportes === 1 ? "" : "s"}` : "",
        ]
          .filter(Boolean)
          .join(" \u00b7 ")
      }
    >
      {enAlerta ? (
        <AlertTriangle className="mr-1 h-3.5 w-3.5 shrink-0" />
      ) : (
        <Receipt className="mr-1 h-3.5 w-3.5 shrink-0 opacity-70" />
      )}
      {total > 0 ? (
        <span className="truncate font-mono tabular-nums">
          $ {total.toLocaleString("es-CO")}
        </span>
      ) : (
        <span className={enAlerta ? "truncate" : "truncate text-muted-foreground"}>
          {enAlerta ? "Faltan costos" : sinTerceros ? "Sin costos" : "Cargar costos"}
        </span>
      )}
      {soportes > 0 && (
        <Paperclip className="ml-1 h-3 w-3 shrink-0 opacity-60" />
      )}
    </Button>
  );
};

const PanelGeneral = () => {
  const navigate = useNavigate();
  const { canEditStructure, role, canEditGeneral, canEditDirectivo, canEditPersonal } = useUserRole();
  const { user } = useAuth();
  const { projects, loading, updateProject: contextUpdateProject, updateProjectMultiple } = useProjects();
  const { globalDateRange, setGlobalDateRange, globalViewMode, setGlobalViewMode, globalSelectedDate, setGlobalSelectedDate } = useDateRange();
  const isAdmin = role?.toLowerCase() === "administrador";
  const generalReadOnly = !canEditGeneral();
  // Los costos son plata. En este panel los ven administrador y operativo; el
  // rol visual no. La columna se filtra al dibujar y no en la configuracion de
  // columnas, porque esa configuracion es la misma para todos los usuarios.
  const puedeVerCostos = role?.toLowerCase() === "administrador" || role?.toLowerCase() === "operativo";
  const costosSoloLectura = !canEditDirectivo();
  // El personal de nomina del evento se marca aca, no en Operaciones. Lo
  // gobierna el mismo permiso de siempre (puede_editar_personal), para no
  // inventar un permiso nuevo que habria que ir a activarle a cada usuario.
  const puedeEditarNomina = canEditPersonal();
  // Para la alerta de costos hay que saber como se llama quien esta mirando:
  // el productor del evento se guarda por nombre, no por id de usuario.
  const { usuarios: usuariosRegistrados } = useUsuariosRegistrados();
  // Los nombres registrados los necesita el filtro de productor para saber
  // cuales de los escritos a mano no corresponden a nadie.
  const nombresRegistrados = useMemo(
    () => usuariosRegistrados.map((u) => u.nombre),
    [usuariosRegistrados]
  );
  const nombreDelUsuario =
    usuariosRegistrados.find((u) => u.id === user?.id)?.nombre ?? null;
  const correoDelUsuario = user?.email ?? null;
  const alertaDeCostos = (p: Project) =>
    puedeVerCostos && alertaVisiblePara(p, { nombreDelUsuario, correoDelUsuario });
  // Se cuentan sobre todos los eventos y no sobre los filtrados: un evento de
  // octubre sin costos no deja de faltar porque el panel este mirando
  // noviembre. Si solo apareciera dentro del filtro, nadie lo encontraria.
  const eventosSinCostos = useMemo(
    () =>
      puedeVerCostos
        ? projects.filter((p) =>
            alertaVisiblePara(p, { nombreDelUsuario, correoDelUsuario })
          )
        : [],
    [projects, nombreDelUsuario, correoDelUsuario, puedeVerCostos]
  );
  // El aviso se cuenta entero, pero se lee por meses: "17" no dice nada si no
  // se sabe que 11 son de octubre y 6 de noviembre.
  const resumenSinCostos = useMemo(() => {
    const porMes = new Map<string, number>();
    for (const p of eventosSinCostos) {
      const mes = mesDeEjecucion(p);
      porMes.set(mes, (porMes.get(mes) ?? 0) + 1);
    }
    return {
      porMes: [...porMes.entries()],
      sinProductor: cuantosSinProductor(eventosSinCostos),
      mios: eventosSinCostos.filter((p) =>
        alertaParpadea(p, { nombreDelUsuario, correoDelUsuario })
      ).length,
    };
  }, [eventosSinCostos, nombreDelUsuario, correoDelUsuario]);
  const [costosDeProyectoId, setCostosDeProyectoId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [filtroProductor, setFiltroProductor] = useState("todos");
  const [highlightedProjectId, setHighlightedProjectId] = useState<string | null>(null);
  const [columnManagerOpen, setColumnManagerOpen] = useState(false);
  const [showDeleted, setShowDeleted] = useState(false);
  const [notaExpandida, setNotaExpandida] = useState<{ evento: string; nota: string } | null>(null);
  const [montajeSort, setMontajeSort] = useState<"asc" | "desc" | null>(null);
  // Initialize with base columns - persisted to localStorage
  const defaultColumns: ColumnConfig[] = [
    { key: "centroCostos", header: "CC", type: "text" as CellType, width: "70px", visible: true, isCustom: false, order: 0 },
    { key: "numFactura", header: "#Factura", type: "text" as CellType, width: "75px", visible: true, isCustom: false, order: 1 },
    { key: "cliente", header: "Cliente", type: "text" as CellType, width: "130px", visible: true, isCustom: false, order: 2 },
    { key: "evento", header: "Evento", type: "text" as CellType, width: "150px", visible: true, isCustom: false, order: 3 },
    { key: "avanzada", header: "Avanzada", type: "select" as CellType, width: "110px", visible: true, isCustom: false, order: 4, options: ["No se hizo", "Se hizo", "No es necesario"] },
    { key: "fechaMontaje", header: "Montaje", type: "date" as CellType, width: "90px", visible: true, isCustom: false, order: 5 },
    { key: "fechaEjecucion", header: "Ejecución", type: "date" as CellType, width: "90px", visible: true, isCustom: false, order: 6 },
    { key: "fechaDesmontaje", header: "Desmontaje", type: "date" as CellType, width: "95px", visible: true, isCustom: false, order: 7 },
    { key: "estado", header: "Estado", type: "select" as CellType, width: "150px", visible: true, isCustom: false, order: 8 },
    { key: "jefeOperaciones", header: "Jefe Ops", type: "text" as CellType, width: "95px", visible: true, isCustom: false, order: 9 },
    { key: "aCargoDe", header: "A Cargo", type: "text" as CellType, width: "85px", visible: true, isCustom: false, order: 10 },
    { key: "productor", header: "Productor", type: "text" as CellType, width: "90px", visible: true, isCustom: false, order: 11 },
    { key: "personalNomina", header: "Personal", type: "text" as CellType, width: "120px", visible: true, isCustom: false, order: 12 },
    { key: "ubicacion", header: "Ubicación", type: "text" as CellType, width: "130px", visible: true, isCustom: false, order: 13 },
    { key: "notas", header: "Notas", type: "text" as CellType, width: "120px", visible: true, isCustom: false, order: 14 },
    { key: "costos", header: "Costos", type: "text" as CellType, width: "110px", visible: true, isCustom: false, order: 15 },
    { key: "panelDirectivo", header: "Panel", type: "text" as CellType, width: "65px", visible: true, isCustom: false, order: 16 },
  ];
  const { columns: managedColumns, setColumns: setManagedColumns, loading: columnsLoading, isAdmin: canModifyStructure } = useGlobalColumns("panel-general", defaultColumns);
  
  // Calendar filter state - using global context
  const [statusFilter, setStatusFilter] = useState<ProjectStatus | "todos">("todos");
  
  // Computed dateRange from global context
  const dateRange = globalDateRange?.from && globalDateRange?.to 
    ? { start: globalDateRange.from, end: globalDateRange.to } 
    : undefined;

  const updateProject = (projectId: string, field: string, value: any) => {
    contextUpdateProject(projectId, field, value);
  };

  const getDateRange = () => {
    if (globalViewMode === "custom" && dateRange) {
      return dateRange;
    }
    switch (globalViewMode) {
      case "day":
        return { start: startOfDay(globalSelectedDate), end: endOfDay(globalSelectedDate) };
      case "week":
        return { start: startOfWeek(globalSelectedDate, { weekStartsOn: 1 }), end: endOfWeek(globalSelectedDate, { weekStartsOn: 1 }) };
      case "month":
        return { start: startOfMonth(globalSelectedDate), end: endOfMonth(globalSelectedDate) };
      case "quarter":
        return { start: startOfQuarter(globalSelectedDate), end: endOfQuarter(globalSelectedDate) };
      case "year":
        return { start: startOfYear(globalSelectedDate), end: endOfYear(globalSelectedDate) };
      default:
        return { start: startOfMonth(globalSelectedDate), end: endOfMonth(globalSelectedDate) };
    }
  };

  const filteredProjects = useMemo(() => {
    let result = projects.filter((p) => {
      const matchesDeleted = showDeleted || !p.isDeleted;
      const matchesSearch = coincideBusquedaDeEvento(p, searchTerm);
      const matchesStatus = statusFilter === "todos" || p.estado === statusFilter;
      const matchesProductor = pasaFiltroDeProductor(p, filtroProductor, nombresRegistrados);
      const range = getDateRange();
      const projectStart = parseISO(p.fechaMontajeInicio);
      const projectEnd = parseISO(p.fechaEjecucionFin);
      const matchesDate = 
        isWithinInterval(projectStart, range) ||
        isWithinInterval(projectEnd, range) ||
        (projectStart <= range.start && projectEnd >= range.end);
      return matchesDeleted && matchesSearch && matchesStatus && matchesProductor && matchesDate;
    });

    if (montajeSort) {
      result = [...result].sort((a, b) => {
        const dateA = a.fechaMontajeInicio || "";
        const dateB = b.fechaMontajeInicio || "";
        if (!dateA && !dateB) return 0;
        if (!dateA) return 1;
        if (!dateB) return -1;
        const cmp = dateA.localeCompare(dateB);
        return montajeSort === "asc" ? cmp : -cmp;
      });
    }

    return result;
  }, [projects, showDeleted, searchTerm, statusFilter, filtroProductor, montajeSort, globalViewMode, globalSelectedDate, globalDateRange]);


  const getRowClassName = (project: Project) => {
    if (project.isDeleted) {
      return "row-deleted";
    }
    return "";
  };

  const handleGanttProjectClick = (projectId: string) => {
    setHighlightedProjectId(projectId);
    const tabTrigger = document.querySelector('[value="matriz"]') as HTMLElement;
    if (tabTrigger) tabTrigger.click();
  };

  // Define base columns
  const baseColumnDefs: ColumnConfig[] = useMemo(() => [
    { key: "centroCostos", header: "CC", type: "text" as CellType, width: "70px", visible: true, isCustom: false, order: 0 },
    { key: "numFactura", header: "#Factura", type: "text" as CellType, width: "75px", visible: true, isCustom: false, order: 1 },
    { key: "cliente", header: "Cliente", type: "text" as CellType, width: "130px", visible: true, isCustom: false, order: 2 },
    { key: "avanzada", header: "Avanzada", type: "select" as CellType, width: "110px", visible: true, isCustom: false, order: 3 },
    { key: "fechaMontaje", header: "Montaje", type: "date" as CellType, width: "90px", visible: true, isCustom: false, order: 4 },
    { key: "fechaEjecucion", header: "Ejecución", type: "date" as CellType, width: "90px", visible: true, isCustom: false, order: 5 },
    { key: "fechaDesmontaje", header: "Desmontaje", type: "date" as CellType, width: "95px", visible: true, isCustom: false, order: 6 },
    { key: "estado", header: "Estado", type: "select" as CellType, width: "150px", visible: true, isCustom: false, order: 7 },
    { key: "ordenCompra", header: "OC + OCR", type: "file" as CellType, width: "90px", visible: true, isCustom: false, order: 8 },
    { key: "costos", header: "Costos", type: "text" as CellType, width: "110px", visible: true, isCustom: false, order: 9 },
    { key: "personalNomina", header: "Personal", type: "text" as CellType, width: "120px", visible: true, isCustom: false, order: 10 },
  ], []);

  // Get all columns - direct calculation for immediate updates
  // Productor de primera: es lo que se mira para saber quien responde por el
  // evento, y quedaba en la columna once, fuera de pantalla.
  const allColumnConfigs = anclarPrimero(
    managedColumns.length > 0 ? managedColumns : baseColumnDefs,
    "productor"
  );

  // Handle columns change - force new array reference
  const handleColumnsChange = (newColumns: ColumnConfig[]) => {
    logger.debug('[PanelGeneral] Received column changes:', newColumns.length, newColumns);
    const copiedColumns = newColumns.map(col => ({ ...col }));
    setManagedColumns(copiedColumns);
  };

  const initializeColumns = () => {
    if (managedColumns.length === 0) {
      setManagedColumns(baseColumnDefs);
    }
    setColumnManagerOpen(true);
  };

  const getColumnRender = (colConfig: ColumnConfig) => {
    switch (colConfig.key) {
      case "costos":
        return (p: Project) => (
          <BotonCostos
            proyecto={p}
            onAbrir={setCostosDeProyectoId}
            enAlerta={alertaDeCostos(p)}
            parpadea={
              puedeVerCostos &&
              alertaParpadea(p, { nombreDelUsuario, correoDelUsuario })
            }
          />
        );
      case "personalNomina":
        return (p: Project) => (
          <PersonalNominaSelect
            value={p.personal}
            onChange={(personal) => updateProject(p.id, "personal", personal)}
            disabled={!puedeEditarNomina}
          />
        );
      case "centroCostos":
        return (p: Project) => generalReadOnly ? (
          <span className="text-sm font-mono">{p.centroCostos || "-"}</span>
        ) : (
          <EditableCell
            value={p.centroCostos}
            type="text"
            onChange={(value) => updateProject(p.id, "centroCostos", value)}
            className="font-mono bg-muted px-2 py-1 rounded"
            placeholder="Ej: 3-00814"
          />
        );
      case "numFactura":
        return (p: Project) => generalReadOnly ? (
          <span className="text-sm font-mono">{p.numFactura || "Sin factura"}</span>
        ) : (
          <EditableCell
            value={p.numFactura}
            type="text"
            onChange={(value) => updateProject(p.id, "numFactura", value)}
            className="font-mono"
            placeholder="Nº factura"
          />
        );
      case "cliente":
        return (p: Project) => generalReadOnly ? (
          <span className="text-sm truncate">{p.cliente || "Sin cliente"}</span>
        ) : (
          <ClienteAutocomplete
            value={p.cliente}
            onChange={(value) => updateProject(p.id, "cliente", value)}
          />
        );
      case "evento":
        return (p: Project) => (
          <EventLink
            eventId={p.id}
            eventName={p.evento}
            isDeleted={p.isDeleted}
            className="font-medium"
            source="general"
          />
        );
      case "avanzada":
        return (p: Project) => generalReadOnly ? (
          <span className="text-xs">{p.avanzada || "Sin asignar"}</span>
        ) : (
          <AvanzadaSelect
            value={p.avanzada}
            onChange={(value) => updateProject(p.id, "avanzada", value)}
          />
        );
      case "fechaMontaje":
        return (p: Project) => generalReadOnly ? (
          <div className="text-xs space-y-0.5">
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-sm bg-gantt-montaje" />
              {format(parseISO(p.fechaMontajeInicio), "dd/MM", { locale: es })}
            </div>
            <div className="text-muted-foreground pl-3">
              → {format(parseISO(p.fechaMontajeFin), "dd/MM", { locale: es })}
            </div>
          </div>
        ) : (
          <DateTimeRangeEditor
            type="montaje"
            value={{
              fechaInicio: p.fechaMontajeInicio,
              fechaFin: p.fechaMontajeFin,
              horaInicio: p.horaMontajeInicio,
              horaFin: p.horaMontajeFin,
            }}
            onChange={(value) => {
              updateProjectMultiple(p.id, {
                fechaMontajeInicio: value.fechaInicio,
                fechaMontajeFin: value.fechaFin,
                horaMontajeInicio: value.horaInicio,
                horaMontajeFin: value.horaFin,
              });
            }}
            displayValue={
              <div className="text-xs space-y-0.5">
                <div className="flex items-center gap-1">
                  <div className="w-2 h-2 rounded-sm bg-gantt-montaje" />
                  {format(parseISO(p.fechaMontajeInicio), "dd/MM", { locale: es })}
                </div>
                <div className="text-muted-foreground pl-3">
                  → {format(parseISO(p.fechaMontajeFin), "dd/MM", { locale: es })}
                </div>
              </div>
            }
          />
        );
      case "fechaEjecucion":
        return (p: Project) => generalReadOnly ? (
          <div className="text-xs space-y-0.5">
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-sm bg-gantt-ejecucion" />
              {format(parseISO(p.fechaEjecucionInicio), "dd/MM", { locale: es })}
            </div>
            <div className="text-muted-foreground pl-3">
              → {format(parseISO(p.fechaEjecucionFin), "dd/MM", { locale: es })}
            </div>
          </div>
        ) : (
          <DateTimeRangeEditor
            type="ejecucion"
            value={{
              fechaInicio: p.fechaEjecucionInicio,
              fechaFin: p.fechaEjecucionFin,
              horaInicio: p.horaEjecucionInicio,
              horaFin: p.horaEjecucionFin,
            }}
            onChange={(value) => {
              updateProjectMultiple(p.id, {
                fechaEjecucionInicio: value.fechaInicio,
                fechaEjecucionFin: value.fechaFin,
                horaEjecucionInicio: value.horaInicio,
                horaEjecucionFin: value.horaFin,
              });
            }}
            displayValue={
              <div className="text-xs space-y-0.5">
                <div className="flex items-center gap-1">
                  <div className="w-2 h-2 rounded-sm bg-gantt-ejecucion" />
                  {format(parseISO(p.fechaEjecucionInicio), "dd/MM", { locale: es })}
                </div>
                <div className="text-muted-foreground pl-3">
                  → {format(parseISO(p.fechaEjecucionFin), "dd/MM", { locale: es })}
                </div>
              </div>
            }
          />
        );
      case "fechaDesmontaje":
        return (p: Project) => generalReadOnly ? (
          p.fechaDesmontajeInicio && p.fechaDesmontajeFin ? (
            <div className="text-xs space-y-0.5">
              <div className="flex items-center gap-1">
                <div className="w-2 h-2 rounded-sm bg-gantt-desmontaje" />
                {format(parseISO(p.fechaDesmontajeInicio), "dd/MM", { locale: es })}
              </div>
              <div className="text-muted-foreground pl-3">
                → {format(parseISO(p.fechaDesmontajeFin), "dd/MM", { locale: es })}
              </div>
            </div>
          ) : (
            <span className="text-muted-foreground text-xs">—</span>
          )
        ) : (
          <DateTimeRangeEditor
            type="desmontaje"
            value={{
              fechaInicio: p.fechaDesmontajeInicio || "",
              fechaFin: p.fechaDesmontajeFin || "",
              horaInicio: p.horaDesmontajeInicio || "",
              horaFin: p.horaDesmontajeFin || "",
            }}
            onChange={(value) => {
              updateProjectMultiple(p.id, {
                fechaDesmontajeInicio: value.fechaInicio,
                fechaDesmontajeFin: value.fechaFin,
                horaDesmontajeInicio: value.horaInicio,
                horaDesmontajeFin: value.horaFin,
              });
            }}
            displayValue={
              p.fechaDesmontajeInicio && p.fechaDesmontajeFin ? (
                <div className="text-xs space-y-0.5">
                  <div className="flex items-center gap-1">
                    <div className="w-2 h-2 rounded-sm bg-gantt-desmontaje" />
                    {format(parseISO(p.fechaDesmontajeInicio), "dd/MM", { locale: es })}
                  </div>
                  <div className="text-muted-foreground pl-3">
                    → {format(parseISO(p.fechaDesmontajeFin), "dd/MM", { locale: es })}
                  </div>
                </div>
              ) : (
                <span className="text-muted-foreground text-xs hover:text-primary cursor-pointer">+ Agregar</span>
              )
            }
          />
        );
      case "estado":
        return (p: Project) => generalReadOnly ? (
          <Badge variant="outline" className="text-[10px]">{p.estado.replace(/_/g, ' ')}</Badge>
        ) : (
          <StatusSelect
            value={p.estado}
            onChange={(value) => updateProject(p.id, "estado", value)}
          />
        );
      case "ordenCompra":
        return (p: Project) => generalReadOnly ? (
          <span className="text-xs text-muted-foreground">{((p as any).ordenesCompra || []).length || "—"}</span>
        ) : (
          <div className="flex items-center gap-1">
            <AttachmentButton
              attachments={(p as any).ordenesCompra || []}
              onAttachmentsChange={(attachments) => updateProject(p.id, "ordenesCompra", attachments)}
              multiple={false}
              projectId={p.id}
              fieldName="ordenesCompra"
            />
            <PurchaseOrderUpload
              currentIngresoBruto={(p as any).ingresoBruto}
              currentIngresoTotal={(p as any).ingresoTotal}
              projectId={p.id}
              onDataExtracted={(ingresoBruto, ingresoTotal, inventarioItems) => {
                // Merge new inventory items with existing ones
                const existingInventario = (p as any).inventario || [];
                const mergedInventario = inventarioItems && inventarioItems.length > 0
                  ? [...existingInventario, ...inventarioItems]
                  : existingInventario;
                
                updateProjectMultiple(p.id, {
                  ingresoBruto: ingresoBruto ?? undefined,
                  ingresoTotal: ingresoTotal ?? undefined,
                  inventario: mergedInventario.length > 0 ? mergedInventario : undefined,
                });
              }}
            />
          </div>
        );
      case "notas":
        return (p: Project) => (
          <div className="flex items-center gap-1 max-w-[200px]">
            <EditableCell
              value={p.notas}
              type="text"
              onChange={(value) => updateProject(p.id, "notas", value)}
              className="truncate text-xs flex-1 min-w-0"
              placeholder="Agregar nota"
              disabled={generalReadOnly}
            />
            {p.notas && p.notas.trim() && (
              <button
                onClick={() => setNotaExpandida({ evento: p.evento, nota: p.notas })}
                className="shrink-0 p-0.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                title="Ver nota completa"
              >
                <Eye className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        );
      // El productor se asigna solo desde el Panel Directivo.
      case "productor":
        return (p: Project) => <ProductorSelect value={p.productor} onChange={() => {}} disabled />;
      default:
        return (p: Project) => generalReadOnly ? (
          <span className="text-sm truncate">{(p as any)[colConfig.key] || "Sin datos"}</span>
        ) : (
          <EditableCell
            value={(p as any)[colConfig.key]}
            type={colConfig.type}
            options={colConfig.options}
            onChange={(value) => updateProject(p.id, colConfig.key, value)}
          />
        );
    }
  };

  const panelColumn = {
    key: "acciones",
    header: "Acciones",
    // Antes cabian dos botones (Directivo y Ops). Quedo solo Directivo.
    width: "150px",
    render: (p: Project) => (
      <div className="flex gap-1 items-center">
        {p.isDeleted && (
          <Badge variant="destructive" className="text-[10px] px-1 py-0 mr-1">
            ELIMINADO
          </Badge>
        )}
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
      </div>
    ),
  };

  // Build columns - direct calculation for immediate updates
  const columns = (() => {
    const visibleColumns = allColumnConfigs
      .filter(col => col.visible)
      // Aunque la columna este marcada como visible en la configuracion global,
      // al rol visual no se le dibuja.
      .filter(col => col.key !== "costos" || puedeVerCostos)
      .filter(col => !COLUMNAS_RETIRADAS.includes(col.key))
      .sort((a, b) => a.order - b.order)
      .map(col => ({
        key: col.key,
        label: col.header,
        header: col.header,
        width: col.width,
        render: getColumnRender(col),
        // "Evento" es la columna que se congela al deslizar en horizontal.
        className: col.key === "evento" ? "matrix-sticky-col" : undefined,
      }));
    
    return [...visibleColumns, panelColumn];
  })();

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-6">
        <PanelHeader
          title="Panel General"
          description="Vista general de proyectos y variables SSOT"
          actions={
            isAdmin && (
              <Button variant="outline" size="sm" onClick={initializeColumns}>
                <Settings className="h-4 w-4 mr-2" />
                Gestionar Columnas
              </Button>
            )
          }
        />

        {/* Calendar Filter */}
        <CalendarFilter
          viewMode={globalViewMode}
          selectedDate={globalSelectedDate}
          dateRange={dateRange}
          statusFilter={statusFilter}
          onViewModeChange={setGlobalViewMode}
          onDateChange={setGlobalSelectedDate}
          onDateRangeChange={(range) => range ? setGlobalDateRange({ from: range.start, to: range.end }) : setGlobalDateRange(undefined)}
          onStatusChange={setStatusFilter}
        />

        <Tabs defaultValue="matriz" className="space-y-4">
          {/* Mobile-optimized controls: toggle visible without scroll */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            {/* Toggle always visible first */}
            <div className="flex items-center gap-3 flex-wrap">
              <TabsList className="w-full sm:w-auto">
                <TabsTrigger value="matriz" className="flex-1 sm:flex-none">Matriz</TabsTrigger>
                <TabsTrigger value="gantt" className="flex-1 sm:flex-none">Calendario</TabsTrigger>
              </TabsList>
              <div className="flex items-center gap-2">
                <Switch
                  id="show-deleted-general"
                  checked={showDeleted}
                  onCheckedChange={setShowDeleted}
                />
                <Label htmlFor="show-deleted-general" className="text-sm text-muted-foreground cursor-pointer whitespace-nowrap">
                  Mostrar eliminados
                </Label>
              </div>
              <Button
                variant={montajeSort ? "default" : "outline"}
                size="sm"
                onClick={() => {
                  if (!montajeSort) setMontajeSort("asc");
                  else if (montajeSort === "asc") setMontajeSort("desc");
                  else setMontajeSort(null);
                }}
                className="h-9 text-xs whitespace-nowrap gap-1.5"
                title={montajeSort === "asc" ? "Montaje: Más antiguo primero" : montajeSort === "desc" ? "Montaje: Más reciente primero" : "Ordenar por Montaje"}
              >
                {montajeSort === "asc" ? <ArrowUp className="h-3.5 w-3.5" /> : montajeSort === "desc" ? <ArrowDown className="h-3.5 w-3.5" /> : <ArrowUpDown className="h-3.5 w-3.5" />}
                Montaje
              </Button>
            </div>

            {eventosSinCostos.length > 0 && (
              <span
                className="inline-flex items-center gap-1.5 rounded-md bg-destructive/10 px-2.5 py-1.5 text-xs font-medium text-destructive ring-1 ring-inset ring-destructive/40"
                title={[
                  "Eventos ya ejecutados a los que les faltan los costos.",
                  "",
                  ...resumenSinCostos.porMes.map(
                    ([mes, n]) => `\u00b7 ${mes}: ${n}`
                  ),
                  resumenSinCostos.mios > 0
                    ? `\n${resumenSinCostos.mios} ${resumenSinCostos.mios === 1 ? "es tuyo" : "son tuyos"} como productor (en rojo intermitente)`
                    : "",
                  resumenSinCostos.sinProductor > 0
                    ? `${resumenSinCostos.sinProductor} sin productor asignado`
                    : "",
                ]
                  .filter((l) => l !== "")
                  .join("\n")}
              >
                <AlertTriangle
                  className={cn(
                    "h-3.5 w-3.5 shrink-0",
                    resumenSinCostos.mios > 0 && "animate-pulse"
                  )}
                />
                {eventosSinCostos.length}{" "}
                {eventosSinCostos.length === 1
                  ? "evento sin costos"
                  : "eventos sin costos"}
                {resumenSinCostos.sinProductor > 0 && (
                  <span className="font-normal opacity-80">
                    ({resumenSinCostos.sinProductor} sin productor)
                  </span>
                )}
              </span>
            )}

            <FiltroProductor
              proyectos={projects}
              value={filtroProductor}
              onChange={setFiltroProductor}
            />

            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar cliente, evento, CC o #factura..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 h-9"
              />
            </div>
          </div>

          <TabsContent value="matriz" className="mt-4">
            <div className="panel-card">
              <MatrixTable
                key={`table-${allColumnConfigs.map(c => `${c.key}-${c.visible}-${c.order}`).join('_')}`}
                data={filteredProjects}
                columns={columns}
                highlightedId={highlightedProjectId}
                getRowClassName={getRowClassName}
                mobileKeys={["evento", "cliente", "productor", "fechaMontaje", "fechaEjecucion", "estado", "costos"]}
                mobilePreferenceKey="panel-general"
                getRowAccent={acentoVisualDeEvento}
                getRowStyle={estiloFilaVisual}
              />
            </div>
          </TabsContent>

          <TabsContent value="gantt" className="mt-4">
            <EventCalendar
                projects={filteredProjects}
                startDate={globalSelectedDate}
                onProjectClick={handleGanttProjectClick}
                onEditarFechas={
                  generalReadOnly
                    ? undefined
                    : (id, cambios) => updateProjectMultiple(id, cambios)
                }
              />
          </TabsContent>
        </Tabs>

        <ColumnManagerDialog
          open={columnManagerOpen}
          onOpenChange={setColumnManagerOpen}
          columns={managedColumns.length > 0 ? managedColumns : defaultColumns}
          onColumnsChange={setManagedColumns}
          panelName="Panel General"
          readOnly={!canModifyStructure}
        />

        {/* Panel de costos del evento. Solo se monta para quien puede verlo. */}
        {puedeVerCostos && (
          <CostosEventoDialog
            proyecto={projects.find((p) => p.id === costosDeProyectoId) ?? null}
            open={Boolean(costosDeProyectoId)}
            onOpenChange={(abierto) => { if (!abierto) setCostosDeProyectoId(null); }}
            soloLectura={costosSoloLectura}
            onGuardar={async (costos: CostoEvento[]) => {
              if (costosDeProyectoId) await updateProject(costosDeProyectoId, "costos", costos);
            }}
            onGuardarAdjuntos={async (archivos) => {
              if (costosDeProyectoId) await updateProject(costosDeProyectoId, "costosAdjuntos", archivos);
            }}
          />
        )}

        {/* Dialog para ver nota completa */}
        <Dialog open={!!notaExpandida} onOpenChange={(open) => !open && setNotaExpandida(null)}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="text-sm">Nota — {notaExpandida?.evento}</DialogTitle>
            </DialogHeader>
            <p className="text-sm whitespace-pre-wrap text-foreground/80 max-h-[60vh] overflow-y-auto">
              {notaExpandida?.nota}
            </p>
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
};

export default PanelGeneral;
