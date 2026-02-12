import { useState, useMemo } from "react";
import { useProjects } from "@/contexts/ProjectsContext";
import { useUserRole } from "@/hooks/useUserRole";
import { Project, CajaMenorItem, LegalizacionItem } from "@/types";
import { format, parseISO, getMonth, getYear } from "date-fns";
import { es } from "date-fns/locale";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { CajaMenorEstadoSelect } from "@/components/CajaMenorEstadoSelect";
import { Search } from "lucide-react";
import { toast } from "sonner";
import { useIsMobile } from "@/hooks/use-mobile";

interface FlattenedRow {
  projectId: string;
  centroCostos: string;
  evento: string;
  item: CajaMenorItem;
  legalizacionTotal: number;
  legalizacionEstado: string;
  saldoAFavor: number;
}

function parseDateSafe(dateStr?: string): Date | null {
  if (!dateStr) return null;
  try {
    return parseISO(dateStr);
  } catch {
    return null;
  }
}

function getLegalizacionForEmployee(
  legalizacion: LegalizacionItem[] | undefined,
  empleadoNombre?: string
): { total: number; estado: string } {
  if (!legalizacion || !empleadoNombre) return { total: 0, estado: "Pendiente" };
  const matched = legalizacion.filter(
    (l) => l.empleadoNombre?.toLowerCase() === empleadoNombre.toLowerCase()
  );
  const total = matched.reduce((sum, l) => sum + (l.valor || 0), 0);
  const allApproved = matched.length > 0 && matched.every((l) => l.estado === "Aprobado");
  const estado = matched.length === 0 ? "Revisando" : allApproved ? "Legalizado" : "Revisando";
  return { total, estado };
}

const MONTHS = [
  "Todos", "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

const LEGALIZACION_ESTADO_OPTIONS = [
  { value: "Revisando", label: "Revisando", className: "bg-yellow-500/20 text-yellow-400" },
  { value: "Legalizado", label: "Legalizado", className: "bg-green-500/20 text-green-400" },
  { value: "Rechazado", label: "Rechazado", className: "bg-red-500/20 text-red-400" },
];

const LEGALIZACION_NO_APROBADO = { value: "No legalizable", label: "No legalizable", className: "bg-red-500/20 text-red-400" };

export default function AprobacionesPendientes() {
  const { projects, updateProject } = useProjects();
  const { canApproveCajaMenor } = useUserRole();
  const isMobile = useIsMobile();

  const [mesFilter, setMesFilter] = useState("Todos");
  const [anioFilter, setAnioFilter] = useState("Todos");
  const [estadoFilter, setEstadoFilter] = useState("Todos");
  const [searchQuery, setSearchQuery] = useState("");

  const availableYears = useMemo(() => {
    const years = new Set<number>();
    projects.forEach((p) => {
      if (p.isDeleted) return;
      (p.cajaMenor || []).forEach((item) => {
        const d = parseDateSafe(item.createdAt);
        if (d) years.add(getYear(d));
      });
    });
    return Array.from(years).sort((a, b) => b - a);
  }, [projects]);

  const rows: FlattenedRow[] = useMemo(() => {
    const result: FlattenedRow[] = [];
    projects.forEach((project) => {
      if (project.isDeleted) return;
      (project.cajaMenor || []).forEach((item) => {
        const leg = getLegalizacionForEmployee(project.legalizacion, item.empleadoNombre);
        result.push({
          projectId: project.id,
          centroCostos: project.centroCostos || "",
          evento: project.evento || "",
          item,
          legalizacionTotal: leg.total,
          legalizacionEstado: leg.estado,
          saldoAFavor: (item.valor || 0) - leg.total,
        });
      });
    });
    result.sort((a, b) => {
      const da = parseDateSafe(a.item.createdAt)?.getTime() || 0;
      const db = parseDateSafe(b.item.createdAt)?.getTime() || 0;
      return db - da;
    });
    return result;
  }, [projects]);

  const filteredRows = useMemo(() => {
    return rows.filter((row) => {
      const d = parseDateSafe(row.item.createdAt);
      if (mesFilter !== "Todos" && d) {
        const monthIndex = MONTHS.indexOf(mesFilter) - 1;
        if (getMonth(d) !== monthIndex) return false;
      }
      if (anioFilter !== "Todos" && d) {
        if (getYear(d) !== parseInt(anioFilter)) return false;
      }
      if (estadoFilter !== "Todos" && row.item.estado !== estadoFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const searchable = [
          row.item.empleadoNombre, row.centroCostos, row.item.concepto,
          row.evento, row.item.categoria,
        ].filter(Boolean).join(" ").toLowerCase();
        if (!searchable.includes(q)) return false;
      }
      return true;
    });
  }, [rows, mesFilter, anioFilter, estadoFilter, searchQuery]);

  // Handle solicitud estado change
  const handleEstadoChange = async (row: FlattenedRow, newEstado: string) => {
    if (!canApproveCajaMenor()) {
      toast.error("No tienes permisos para cambiar el estado");
      return;
    }
    const project = projects.find((p) => p.id === row.projectId);
    if (!project) return;
    const updatedCajaMenor = (project.cajaMenor || []).map((item) =>
      item.id === row.item.id ? { ...item, estado: newEstado } : item
    );
    await updateProject(row.projectId, "cajaMenor", updatedCajaMenor);

    // If "No aprobado", auto-set legalizacion to "No legalizable"
    if (newEstado === "No aprobado") {
      const updatedLegalizacion = (project.legalizacion || []).map((l) => {
        if (l.empleadoNombre?.toLowerCase() === row.item.empleadoNombre?.toLowerCase()) {
          return { ...l, estado: "No legalizable" };
        }
        return l;
      });
      await updateProject(row.projectId, "legalizacion", updatedLegalizacion);
    }

    toast.success(`Estado de solicitud actualizado a "${newEstado}"`);
  };

  // Handle legalizacion estado change
  const handleLegalizacionEstadoChange = async (row: FlattenedRow, newEstado: string) => {
    if (!canApproveCajaMenor()) {
      toast.error("No tienes permisos para cambiar el estado");
      return;
    }
    const project = projects.find((p) => p.id === row.projectId);
    if (!project) return;
    const updatedLegalizacion = (project.legalizacion || []).map((l) => {
      if (l.empleadoNombre?.toLowerCase() === row.item.empleadoNombre?.toLowerCase()) {
        return { ...l, estado: newEstado };
      }
      return l;
    });
    await updateProject(row.projectId, "legalizacion", updatedLegalizacion);
    toast.success(`Estado de legalización actualizado a "${newEstado}"`);
  };

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", minimumFractionDigits: 0 }).format(value);

  return (
    <div className="flex flex-col gap-4 h-full">
      {/* Filters */}
      <div className={`flex ${isMobile ? "flex-col" : "flex-row"} gap-3 items-end flex-shrink-0`}>
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">Mes</label>
          <Select value={mesFilter} onValueChange={setMesFilter}>
            <SelectTrigger className="w-[130px] h-9 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {MONTHS.map((m) => (
                <SelectItem key={m} value={m} className="text-xs">{m}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">Año</label>
          <Select value={anioFilter} onValueChange={setAnioFilter}>
            <SelectTrigger className="w-[100px] h-9 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Todos" className="text-xs">Todos</SelectItem>
              {availableYears.map((y) => (
                <SelectItem key={y} value={String(y)} className="text-xs">{y}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">Estado Presupuesto</label>
          <Select value={estadoFilter} onValueChange={setEstadoFilter}>
            <SelectTrigger className="w-[150px] h-9 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Todos" className="text-xs">Todos</SelectItem>
              <SelectItem value="Pendiente" className="text-xs">Pendiente</SelectItem>
              <SelectItem value="Aprobado" className="text-xs">Aprobado</SelectItem>
              <SelectItem value="No aprobado" className="text-xs">No aprobado</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1 flex-1 min-w-[200px]">
          <label className="text-xs font-medium text-muted-foreground">Buscar</label>
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Empleado, CC, descripción, evento..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 h-9 text-xs"
            />
          </div>
        </div>
      </div>

      <div className="text-xs text-muted-foreground flex-shrink-0">
        {filteredRows.length} solicitud{filteredRows.length !== 1 ? "es" : ""} encontrada{filteredRows.length !== 1 ? "s" : ""}
      </div>

      {/* Table with visible scrollbar */}
      <div
        className="flex-1 min-h-0 border rounded-md overflow-auto"
        style={{
          maxHeight: "clamp(360px, 50vh, 600px)",
          scrollbarWidth: "auto",
          scrollbarColor: "hsl(var(--muted-foreground) / 0.3) transparent",
        }}
      >
        <Table>
          <TableHeader className="sticky top-0 bg-muted/80 backdrop-blur-sm z-10">
            <TableRow>
              <TableHead className="text-xs">Fecha</TableHead>
              <TableHead className="text-xs">CC</TableHead>
              <TableHead className="text-xs">Empleado</TableHead>
              <TableHead className="text-xs">Requerido para</TableHead>
              <TableHead className="text-xs">Categoría</TableHead>
              <TableHead className="text-xs">Descripción</TableHead>
              <TableHead className="text-xs text-right">Valor</TableHead>
              <TableHead className="text-xs w-[140px]">Estado Solicitud</TableHead>
              <TableHead className="text-xs text-right">Legalización</TableHead>
              <TableHead className="text-xs w-[140px]">Estado Legaliz.</TableHead>
              <TableHead className="text-xs text-right">Saldo</TableHead>
              <TableHead className="text-xs w-[80px]">Acción</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredRows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={12} className="text-center text-muted-foreground py-8 text-sm">
                  No se encontraron solicitudes
                </TableCell>
              </TableRow>
            ) : (
              filteredRows.map((row) => {
                const d = parseDateSafe(row.item.createdAt);
                return (
                  <TableRow key={`${row.projectId}-${row.item.id}`}>
                    <TableCell className="text-xs">
                      {d ? format(d, "dd/MM/yyyy") : "—"}
                    </TableCell>
                    <TableCell className="text-xs">{row.centroCostos || "—"}</TableCell>
                    <TableCell className="text-xs font-medium">{row.item.empleadoNombre || "—"}</TableCell>
                    <TableCell className="text-xs">{row.evento || "—"}</TableCell>
                    <TableCell className="text-xs">{row.item.recursos || "—"}</TableCell>
                    <TableCell className="text-xs max-w-[200px] truncate" title={row.item.concepto}>
                      {row.item.concepto || "—"}
                    </TableCell>
                    <TableCell className="text-xs text-right font-medium">
                      {formatCurrency(row.item.valor || 0)}
                    </TableCell>
                    {/* Estado Solicitud - editable for admin */}
                    <TableCell className="text-xs">
                      {canApproveCajaMenor() ? (
                        <CajaMenorEstadoSelect
                          value={row.item.estado}
                          onChange={(v) => handleEstadoChange(row, v)}
                        />
                      ) : (
                        <CajaMenorEstadoSelect
                          value={row.item.estado}
                          onChange={() => {}}
                          readOnly
                        />
                      )}
                    </TableCell>
                    <TableCell className="text-xs text-right">
                      {formatCurrency(row.legalizacionTotal)}
                    </TableCell>
                    {/* Estado Legalización - editable only after solicitud is Aprobado */}
                    <TableCell className="text-xs">
                      {row.item.estado === "No aprobado" ? (
                        <span className={`text-xs font-medium px-2 py-0.5 rounded ${LEGALIZACION_NO_APROBADO.className}`}>
                          {LEGALIZACION_NO_APROBADO.label}
                        </span>
                      ) : canApproveCajaMenor() && row.item.estado === "Aprobado" ? (
                        <Select
                          value={row.legalizacionEstado}
                          onValueChange={(v) => handleLegalizacionEstadoChange(row, v)}
                        >
                          <SelectTrigger
                            className={`h-7 text-xs w-full border font-medium ${
                              LEGALIZACION_ESTADO_OPTIONS.find(o => o.value === row.legalizacionEstado)?.className || ""
                            }`}
                            onClick={(e) => e.stopPropagation()}
                          >
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="bg-popover border-border z-50">
                            {LEGALIZACION_ESTADO_OPTIONS.map((option) => (
                              <SelectItem
                                key={option.value}
                                value={option.value}
                                className={`text-xs font-medium ${option.className}`}
                              >
                                {option.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        <span className={`text-xs font-medium px-2 py-0.5 rounded ${
                          LEGALIZACION_ESTADO_OPTIONS.find(o => o.value === row.legalizacionEstado)?.className || "bg-yellow-500/20 text-yellow-400"
                        }`}>
                          {row.legalizacionEstado || "Revisando"}
                        </span>
                      )}
                    </TableCell>
                    {/* Saldo: green if positive (a favor), red if negative (en contra) */}
                    <TableCell className={`text-xs text-right font-medium ${
                      row.saldoAFavor > 0 ? "text-green-400" : row.saldoAFavor < 0 ? "text-red-400" : ""
                    }`}>
                      {formatCurrency(Math.abs(row.saldoAFavor))}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="link"
                        size="sm"
                        className="h-7 px-1 text-xs text-primary underline"
                        onClick={() => {
                          window.open(`/?proyecto=${row.projectId}&seccion=gastos&evento=${encodeURIComponent(row.evento)}`, "_blank");
                        }}
                      >
                        Ver más
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* Custom scrollbar styles */}
      <style>{`
        .flex-1.overflow-auto::-webkit-scrollbar {
          width: 10px;
          height: 10px;
        }
        .flex-1.overflow-auto::-webkit-scrollbar-track {
          background: transparent;
        }
        .flex-1.overflow-auto::-webkit-scrollbar-thumb {
          background: hsl(var(--muted-foreground) / 0.3);
          border-radius: 5px;
        }
        .flex-1.overflow-auto::-webkit-scrollbar-thumb:hover {
          background: hsl(var(--muted-foreground) / 0.5);
        }
      `}</style>
    </div>
  );
}
