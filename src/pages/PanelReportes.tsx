import { useState, useCallback, useMemo, useEffect } from "react";
import Layout from "@/components/Layout";
import { FileBarChart, DollarSign, ArrowLeft, Wallet, ClipboardCheck, Receipt, Plus, Trash2, Eye, Lock, ChevronUp, ChevronDown, Ban, Search, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import DeleteCierreDialog from "@/components/reports/DeleteCierreDialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import ReporteCajaMenor from "@/components/reports/ReporteCajaMenor";
import CajaMenorCharts from "@/components/reports/CajaMenorCharts";
import AprobacionesPendientes from "@/components/reports/AprobacionesPendientes";
import GastoMenorDialog from "@/components/reports/GastoMenorDialog";
import { useIsMobile } from "@/hooks/use-mobile";
import { useGastosMenores } from "@/hooks/useGastosMenores";
import { useCajaMenorConfig } from "@/hooks/useCajaMenorConfig";
import ErrorBoundary from "@/components/ErrorBoundary";
import EstadoCajaMenor from "@/components/reports/EstadoCajaMenor";
import { CajaMenorEstadoSelect } from "@/components/CajaMenorEstadoSelect";
import { useUserRole } from "@/hooks/useUserRole";
import { useActiveUndoLog } from "@/hooks/useActiveUndoLog";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { toast } from "sonner";

type ReportView = "main" | "financieros" | "caja-menor" | "reporte-caja-menor" | "aprobaciones";
const fmtCOP = (v: number) =>
  new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(v);

const PanelReportes = () => {
  const [currentView, setCurrentView] = useState<ReportView>("main");
  const [gastoDialogOpen, setGastoDialogOpen] = useState(false);
  const [selectedGastoIds, setSelectedGastoIds] = useState<Set<string>>(new Set());
  const [cajaOpen, setCajaOpen] = useState(true);
  const [viewingCierreSnapshot, setViewingCierreSnapshot] = useState<any>(null);
  const [historialOpen, setHistorialOpen] = useState(false);
  const [deleteCierreId, setDeleteCierreId] = useState<string | null>(null);
  const [showDeletedCierres, setShowDeletedCierres] = useState(false);
  const [historialSearch, setHistorialSearch] = useState("");
  const [historialSort, setHistorialSort] = useState<{ field: "fecha" | "valor"; dir: "asc" | "desc" } | null>(null);
  const isMobile = useIsMobile();
  const { gastos, loading, addGasto, deleteGasto } = useGastosMenores(undefined, { applyUndoOverlay: true });
  const { config, cierres, stats, currentPeriodGastos, updateBaseAndReembolso: saveBaseAndReembolso, registerResponsable, realizarCierre } = useCajaMenorConfig(gastos);
  const { canApproveCajaMenor, canAjustarBaseCajaMenor, role } = useUserRole();
  const { entries: undoEntries } = useActiveUndoLog();

  /** Returns true if gasto has an active undo timer (name should be hidden) */
  const hasActiveUndoForGasto = (gastoId: string, currentEstado: string) => {
    const entry = undoEntries.find(e => e.source === "gastoMenor" && e.item_id === `gm-${gastoId}`);
    // Only active if the gasto's current estado matches what the undo entry says it was changed to
    return entry ? entry.new_estado === currentEstado : false;
  };
  const isAdmin = role === "administrador";
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data?.user?.id) setCurrentUserId(data.user.id);
    });
  }, []);

  const chartsBase = viewingCierreSnapshot ? (viewingCierreSnapshot.base_asignada || 0) : stats.base;
  const chartsGastos = viewingCierreSnapshot ? [] : currentPeriodGastos;

  const handleSaveBaseAndReembolso = async (newBase: number, newReembolso: number) => {
    return await saveBaseAndReembolso(newBase, newReembolso);
  };

  const toggleGastoSelection = useCallback((id: string) => {
    setSelectedGastoIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const toggleAllGastos = useCallback(() => {
    const selectableGastos = currentPeriodGastos.filter(g => g.estado === "Aprobado" && !hasActiveUndoForGasto(g.id, g.estado));
    if (selectedGastoIds.size === selectableGastos.length && selectableGastos.length > 0) {
      setSelectedGastoIds(new Set());
    } else {
      setSelectedGastoIds(new Set(selectableGastos.map(g => g.id)));
    }
  }, [currentPeriodGastos, selectedGastoIds, undoEntries]);

  const handleCierreCaja = async () => {
    const result = await realizarCierre("Legalizado");
    if (result) {
      setSelectedGastoIds(new Set());
      setCajaOpen(false);
    }
  };

  const handleLegalizar = async () => {
    if (selectedGastoIds.size === 0) return;
    const ids = Array.from(selectedGastoIds);
    const { data: userData } = await supabase.auth.getUser();
    let aprobadorNombre = "Admin";
    const { data: empData } = await supabase.rpc("get_my_employee");
    if (empData && empData.length > 0) aprobadorNombre = empData[0].nombre;

    const { error } = await supabase
      .from("gastos_menores")
      .update({ estado: "Legalizado", aprobado_por_id: userData?.user?.id || null, aprobado_por_nombre: aprobadorNombre } as any)
      .in("id", ids);
    if (error) {
      toast.error("Error al legalizar gastos: " + error.message);
    } else {
      toast.success(`${ids.length} gasto(s) legalizado(s)`);
      setSelectedGastoIds(new Set());
    }
  };

  const handleEstadoChange = async (gastoId: string, newEstado: string) => {
    const { data: userData } = await supabase.auth.getUser();
    let aprobadorNombre = "Admin";
    const { data: empData } = await supabase.rpc("get_my_employee");
    if (empData && empData.length > 0) aprobadorNombre = empData[0].nombre;

    const updateData = newEstado === "Pendiente"
      ? { estado: newEstado, aprobado_por_id: null, aprobado_por_nombre: "" }
      : { estado: newEstado, aprobado_por_id: userData?.user?.id || null, aprobado_por_nombre: aprobadorNombre };

    const { error } = await supabase
      .from("gastos_menores")
      .update(updateData as any)
      .eq("id", gastoId);
    if (error) {
      toast.error("Error al actualizar estado: " + error.message);
    }
  };

  const handleDeleteGasto = async (id: string) => {
    if (!confirm("¿Estás seguro de que deseas eliminar este gasto?")) return;
    await deleteGasto(id);
  };

  const renderMainView = () => (
    <div className="space-y-6">
      {/* Header */}
      <div className="space-y-2">
        <h1 className="text-2xl font-bold text-foreground">Panel de Reportes</h1>
        <p className="text-muted-foreground">Reportes administrativos y analíticos</p>
      </div>

      {/* Report Categories */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Reportes Financieros Card */}
        <Card
          className="cursor-pointer hover:border-primary/50 transition-colors group"
          onClick={() => setCurrentView("financieros")}
        >
          <CardHeader className="pb-2">
            <div className="w-14 h-14 rounded-xl bg-emerald-500/10 flex items-center justify-center mb-3 group-hover:bg-emerald-500/20 transition-colors">
              <DollarSign className="w-7 h-7 text-emerald-500" />
            </div>
            <CardTitle className="text-lg">Reportes Financieros</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">Reporte de gastos, caja menor y análisis financiero.</p>
          </CardContent>
        </Card>

        {/* Placeholder cards for future reports */}
        <Card className="opacity-50 cursor-not-allowed">
          <CardHeader className="pb-2">
            <div className="w-14 h-14 rounded-xl bg-muted/30 flex items-center justify-center mb-3">
              <FileBarChart className="w-7 h-7 text-muted-foreground" />
            </div>
            <CardTitle className="text-lg text-muted-foreground">Reportes de Horas</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground/70">Próximamente disponible</p>
          </CardContent>
        </Card>

        <Card className="opacity-50 cursor-not-allowed">
          <CardHeader className="pb-2">
            <div className="w-14 h-14 rounded-xl bg-muted/30 flex items-center justify-center mb-3">
              <FileBarChart className="w-7 h-7 text-muted-foreground" />
            </div>
            <CardTitle className="text-lg text-muted-foreground">Reportes de Personal</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground/70">Próximamente disponible</p>
          </CardContent>
        </Card>
      </div>

    </div>
  );

  const renderFinancierosView = () => (
    <div className="space-y-6">
      {/* Header with back button */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => setCurrentView("main")} className="shrink-0">
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div className="space-y-1">
          <h1 className="text-2xl font-bold text-foreground">Reportes Financieros</h1>
          <p className="text-muted-foreground">Seleccione el tipo de reporte</p>
        </div>
      </div>

      {/* Bandeja de Aprobación */}
      <div className="space-y-2">
        <h2 className="text-lg font-semibold text-foreground">Bandeja de Aprobación</h2>
        <p className="text-sm text-muted-foreground">Revisión y aprobación de solicitudes</p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <Card
          className="cursor-pointer hover:border-primary/50 transition-colors group"
          onClick={() => setCurrentView("aprobaciones")}
        >
          <CardHeader className="pb-2">
            <div className="w-14 h-14 rounded-xl bg-blue-500/10 flex items-center justify-center mb-3 group-hover:bg-blue-500/20 transition-colors">
              <ClipboardCheck className="w-7 h-7 text-blue-500" />
            </div>
            <CardTitle className="text-lg">Aprobaciones Pendientes</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">Revisión y aprobación de solicitudes de presupuesto.</p>
          </CardContent>
        </Card>
      </div>

      {/* Financial Reports */}
      <div className="space-y-2">
        <h2 className="text-lg font-semibold text-foreground">Reportes</h2>
        <p className="text-sm text-muted-foreground">Seleccione el tipo de reporte</p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Reporte Gastos Eventos */}
        <Card
          className="cursor-pointer hover:border-primary/50 transition-colors group"
          onClick={() => setCurrentView("caja-menor")}
        >
          <CardHeader className="pb-2">
            <div className="w-14 h-14 rounded-xl bg-amber-500/10 flex items-center justify-center mb-3 group-hover:bg-amber-500/20 transition-colors">
              <Wallet className="w-7 h-7 text-amber-500" />
            </div>
            <CardTitle className="text-lg">Reporte de Gasto de Eventos</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">Consolidado de gastos de caja menor de todos los eventos.</p>
          </CardContent>
        </Card>

        {/* Reporte de Caja Menor */}
        <Card
          className="cursor-pointer hover:border-primary/50 transition-colors group"
          onClick={() => setCurrentView("reporte-caja-menor")}
        >
          <CardHeader className="pb-2">
            <div className="w-14 h-14 rounded-xl bg-cyan-500/10 flex items-center justify-center mb-3 group-hover:bg-cyan-500/20 transition-colors">
              <Receipt className="w-7 h-7 text-cyan-500" />
            </div>
            <CardTitle className="text-lg">Reporte de Caja Menor</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">Control y seguimiento de los movimientos de caja menor.</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );

  const renderCajaMenorView = () => (
    <div className="flex flex-col h-[calc(100vh-120px)] gap-4">
      {/* Header with back button - fixed */}
      <div className="flex items-center gap-4 flex-shrink-0">
        <Button variant="ghost" size="icon" onClick={() => setCurrentView("financieros")} className="shrink-0">
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div className="space-y-1">
          <h1 className="text-2xl font-bold text-foreground">Reporte Gastos De Eventos</h1>
          <p className="text-muted-foreground">Consolidado de todos los eventos</p>
        </div>
      </div>

      {/* Caja Menor Report Component - takes remaining height */}
      <div className="flex-1 min-h-0">
        <ErrorBoundary
          title="No se pudo cargar el Reporte de Gasto de Eventos"
          description="Esto suele pasar por un registro con datos incompletos (fecha/categoría/estado). Presiona Reintentar o revisa los registros."
          showDetails
        >
          <ReporteCajaMenor />
        </ErrorBoundary>
      </div>
    </div>
  );

  const renderReporteCajaMenorView = () => (
    <div className="flex flex-col h-[calc(100vh-120px)] gap-4">
      <div className="flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => setCurrentView("financieros")} className="shrink-0">
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="space-y-1">
            <h1 className="text-2xl font-bold text-foreground">Reporte de Caja Menor</h1>
            <p className="text-muted-foreground">Control y seguimiento de movimientos</p>
          </div>
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-auto space-y-4">
        {/* Charts - only show gastos from current caja period */}
        <CajaMenorCharts gastos={chartsGastos} base={chartsBase} snapshotStats={viewingCierreSnapshot} />

        {/* Read-only view of a historical cierre */}
        {viewingCierreSnapshot && (
          <Card className="border-primary/30 bg-primary/5">
            <CardContent className="p-0">
              <EstadoCajaMenor
                config={{
                  id: "snapshot",
                  base_asignada: viewingCierreSnapshot.base_asignada || 0,
                  responsable_user_id: null,
                  responsable_nombre: viewingCierreSnapshot.responsable_nombre || "",
                  responsable_timestamp: viewingCierreSnapshot.responsable_timestamp || null,
                  estado_cierre: viewingCierreSnapshot.estado_cierre || "Cerrada",
                  desembolso: viewingCierreSnapshot.reembolsado || 0,
                  desembolsado_por: "",
                  fecha_cierre: viewingCierreSnapshot.fecha_cierre || null,
                  created_at: "",
                  updated_at: "",
                }}
                stats={{
                  base: viewingCierreSnapshot.base_asignada || 0,
                  totalAprobados: viewingCierreSnapshot.total_aprobados || 0,
                  totalPendientes: viewingCierreSnapshot.total_pendientes || 0,
                  efectivoEnCaja: viewingCierreSnapshot.saldo_en_caja || 0,
                  reembolsado: viewingCierreSnapshot.reembolsado || 0,
                }}
                isAdmin={false}
                canAjustarBase={false}
                selectedGastosCount={0}
                onRegisterResponsable={() => {}}
                onCierre={() => {}}
                onLegalizar={() => {}}
                onAgregarGasto={() => {}}
                onSaveBaseAndReembolso={async () => false}
                readOnly
              />
              {viewingCierreSnapshot.gastos && viewingCierreSnapshot.gastos.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Fecha</TableHead>
                      <TableHead>Centro de Costos</TableHead>
                      <TableHead>Concepto</TableHead>
                      <TableHead>Categoría</TableHead>
                      <TableHead>Nombre Comercio</TableHead>
                      <TableHead>NIT/CC</TableHead>
                      <TableHead className="text-right">Valor</TableHead>
                      <TableHead>Imagen</TableHead>
                      <TableHead>Estado</TableHead>
                      <TableHead>Cambio hecho por</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {viewingCierreSnapshot.gastos.map((g: any, idx: number) => (
                      <TableRow key={g.id || idx}>
                        <TableCell className="text-xs whitespace-nowrap">
                          {g.created_at ? format(new Date(g.created_at), "dd/MM/yyyy", { locale: es }) : "—"}
                        </TableCell>
                        <TableCell className="text-xs">{g.centro_costos || "—"}</TableCell>
                        <TableCell className="text-xs">{g.concepto || "—"}</TableCell>
                        <TableCell className="text-xs">{g.categoria || "—"}</TableCell>
                        <TableCell className="text-xs">{g.nombre_comercio || "—"}</TableCell>
                        <TableCell className="text-xs">{g.nit_cc || "—"}</TableCell>
                        <TableCell className="text-xs text-right font-mono">
                          $ {(g.valor || 0).toLocaleString("es-CO")}
                        </TableCell>
                        <TableCell>
                          {g.imagen_url ? (
                            <a href={g.imagen_url} target="_blank" rel="noopener noreferrer" className="text-xs text-primary underline">Ver</a>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <CajaMenorEstadoSelect value={g.estado || "Pendiente"} onChange={() => {}} readOnly />
                        </TableCell>
                        <TableCell className="text-xs whitespace-nowrap">{g.aprobado_por_nombre || "—"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : viewingCierreSnapshot.gastos_count != null ? (
                <p className="text-xs text-muted-foreground text-center py-3">
                  {viewingCierreSnapshot.gastos_count} gasto(s) incluidos en este cierre
                </p>
              ) : null}
            </CardContent>
            <div className="px-4 pb-3 flex justify-end">
              <Button variant="outline" size="sm" onClick={() => setViewingCierreSnapshot(null)}>
                Cerrar vista
              </Button>
            </div>
          </Card>
        )}

        {/* Estado de Caja Menor + Gastos Table - current period */}
        {!viewingCierreSnapshot && cajaOpen ? (
          <Card className="border-primary/30 bg-primary/5">
            <CardContent className="p-0">
              <EstadoCajaMenor
                config={config}
                stats={stats}
                isAdmin={isAdmin}
                canAjustarBase={canAjustarBaseCajaMenor()}
                selectedGastosCount={selectedGastoIds.size}
                onRegisterResponsable={registerResponsable}
                onCierre={handleCierreCaja}
                onLegalizar={handleLegalizar}
                onAgregarGasto={() => setGastoDialogOpen(true)}
                onSaveBaseAndReembolso={handleSaveBaseAndReembolso}
                onClose={() => setCajaOpen(false)}
                hasGastos={currentPeriodGastos.length > 0}
              />
              {loading ? (
                <p className="text-sm text-muted-foreground text-center py-8">Cargando gastos...</p>
              ) : gastos.length === 0 ? (
                <div className="flex items-center justify-center py-12">
                  <p className="text-muted-foreground">No hay gastos registrados.</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[40px]">
                        <Checkbox
                          checked={gastos.filter(g => g.estado === "Aprobado").length > 0 && selectedGastoIds.size === gastos.filter(g => g.estado === "Aprobado").length}
                          onCheckedChange={toggleAllGastos}
                        />
                      </TableHead>
                      <TableHead>Fecha</TableHead>
                      <TableHead>Centro de Costos</TableHead>
                      <TableHead>Concepto</TableHead>
                      <TableHead>Categoría</TableHead>
                      <TableHead>Nombre Comercio</TableHead>
                      <TableHead>NIT/CC</TableHead>
                      <TableHead className="text-right">Valor</TableHead>
                      <TableHead>Imagen</TableHead>
                      <TableHead>Estado</TableHead>
                      <TableHead>Cambio hecho por</TableHead>
                      <TableHead className="w-[50px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {currentPeriodGastos.map((g) => (
                      <TableRow key={g.id}>
                        <TableCell>
                          {g.estado === "Aprobado" && !hasActiveUndoForGasto(g.id, g.estado) ? (
                            <Checkbox
                              checked={selectedGastoIds.has(g.id)}
                              onCheckedChange={() => toggleGastoSelection(g.id)}
                            />
                          ) : (
                            <span className="block w-4" />
                          )}
                        </TableCell>
                        <TableCell className="text-xs whitespace-nowrap">
                          {format(new Date(g.created_at), "dd/MM/yyyy", { locale: es })}
                        </TableCell>
                        <TableCell className="text-xs">{g.centro_costos || "—"}</TableCell>
                        <TableCell className="text-xs">{g.concepto}</TableCell>
                        <TableCell className="text-xs">{g.categoria}</TableCell>
                        <TableCell className="text-xs">{g.nombre_comercio || "—"}</TableCell>
                        <TableCell className="text-xs">{g.nit_cc || "—"}</TableCell>
                        <TableCell className="text-xs text-right font-mono">
                          $ {g.valor.toLocaleString("es-CO")}
                        </TableCell>
                        <TableCell>
                          {g.imagen_url ? (
                            <a href={g.imagen_url} target="_blank" rel="noopener noreferrer" className="text-xs text-primary underline">Ver</a>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <CajaMenorEstadoSelect value={g.estado} onChange={() => {}} readOnly />
                        </TableCell>
                        <TableCell className="text-xs whitespace-nowrap">
                          {hasActiveUndoForGasto(g.id, g.estado) ? (
                            <span className="text-muted-foreground italic flex items-center gap-1">
                              <Lock className="h-3 w-3" /> En proceso
                            </span>
                          ) : (g.aprobado_por_nombre || "—")}
                        </TableCell>
                        <TableCell>
                          {g.usuario_id === currentUserId && g.estado !== "Aprobado" && g.estado !== "Legalizado" && g.estado !== "Reembolsado" && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-destructive hover:text-destructive hover:bg-destructive/10"
                              onClick={() => handleDeleteGasto(g.id)}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        ) : !viewingCierreSnapshot ? (
          <Card className="border-primary/30 bg-primary/5">
            <CardContent className="flex items-center justify-center py-8">
              <Button
                size="lg"
                onClick={() => {
                  setCajaOpen(true);
                  registerResponsable();
                }}
                className="gap-2"
              >
                Realizar cierre de caja
              </Button>
            </CardContent>
          </Card>
        ) : null}

        {/* Historial de Cierres */}
        {cierres.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                size="sm"
                className="text-xs gap-1.5"
                onClick={() => setHistorialOpen(prev => !prev)}
              >
                {historialOpen ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                Historial de Cierres de Caja ({cierres.filter(c => !c.deleted_at).length})
              </Button>
              {historialOpen && cierres.some(c => !!c.deleted_at) && (
                <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={showDeletedCierres}
                    onChange={(e) => setShowDeletedCierres(e.target.checked)}
                    className="rounded border-border"
                  />
                  Mostrar eliminados
                </label>
              )}
            </div>
            {historialOpen && (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Fecha Cierre</TableHead>
                    <TableHead>Responsable</TableHead>
                    <TableHead className="text-right">Valor Total</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead>Desembolsado por</TableHead>
                    <TableHead>Cambios Base</TableHead>
                    <TableHead className="w-[120px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {[...cierres]
                    .sort((a, b) => {
                      const aDeleted = !!a.deleted_at ? 1 : 0;
                      const bDeleted = !!b.deleted_at ? 1 : 0;
                      return aDeleted - bDeleted;
                    })
                    .filter(c => showDeletedCierres || !c.deleted_at)
                    .map((c) => {
                    const isDeleted = !!c.deleted_at;
                    return (
                      <TableRow key={c.id} className={isDeleted ? "bg-destructive/10" : ""}>
                        <TableCell className="text-xs">
                          <div className="flex items-center gap-1.5">
                            {isDeleted && (
                              <Popover>
                                <PopoverTrigger asChild>
                                  <button className="text-destructive hover:text-destructive/80 cursor-pointer">
                                    <Ban className="h-3.5 w-3.5" />
                                  </button>
                                </PopoverTrigger>
                                <PopoverContent className="w-72 text-xs space-y-1">
                                  <p className="font-semibold text-destructive">Cierre eliminado</p>
                                  <p><span className="font-medium">Por:</span> {c.deleted_by || "—"}</p>
                                  <p><span className="font-medium">Motivo:</span> {c.deleted_reason || "—"}</p>
                                  <p><span className="font-medium">Fecha:</span> {c.deleted_at ? format(new Date(c.deleted_at), "dd/MM/yyyy HH:mm", { locale: es }) : "—"}</p>
                                </PopoverContent>
                              </Popover>
                            )}
                            {format(new Date(c.fecha_cierre), "dd/MM/yyyy HH:mm", { locale: es })}
                          </div>
                        </TableCell>
                        <TableCell className="text-xs">{c.responsable_nombre}</TableCell>
                        <TableCell className="text-xs text-right font-mono">$ {c.valor_total.toLocaleString("es-CO")}</TableCell>
                        <TableCell>
                          <CajaMenorEstadoSelect value={isDeleted ? "Eliminado" : c.estado} onChange={() => {}} readOnly />
                        </TableCell>
                        <TableCell className="text-xs">{c.desembolsado_por || "—"}</TableCell>
                        <TableCell className="text-xs">{c.cambios_base || "—"}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            {!isDeleted && (
                              <>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="text-[11px] h-7 gap-1"
                                  onClick={() => {
                                    const snap = (c as any).snapshot || {};
                                    const parsedBase = c.cambios_base ? Number(c.cambios_base.replace(/[^0-9]/g, "")) || 0 : 0;
                                    setViewingCierreSnapshot({
                                      base_asignada: snap.base_asignada || parsedBase,
                                      total_aprobados: snap.total_aprobados || c.valor_total || 0,
                                      total_pendientes: snap.total_pendientes || 0,
                                      saldo_en_caja: snap.saldo_en_caja ?? ((snap.base_asignada || parsedBase) - (snap.total_aprobados || c.valor_total || 0)),
                                      reembolsado: snap.reembolsado || 0,
                                      responsable_nombre: snap.responsable_nombre || c.responsable_nombre || "",
                                      responsable_timestamp: snap.responsable_timestamp || null,
                                      estado_cierre: snap.estado_cierre || c.estado || "Cerrada",
                                      gastos_count: snap.gastos_count ?? null,
                                      gastos: snap.gastos || null,
                                      fecha_cierre: c.fecha_cierre,
                                    });
                                  }}
                                >
                                  <Eye className="h-3 w-3" /> Ver más
                                </Button>
                                {isAdmin && (
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7 text-destructive hover:text-destructive hover:bg-destructive/10"
                                    onClick={() => setDeleteCierreId(c.id)}
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </Button>
                                )}
                              </>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </div>
        )}

        {deleteCierreId && (
          <DeleteCierreDialog
            open={!!deleteCierreId}
            onOpenChange={(open) => { if (!open) setDeleteCierreId(null); }}
            cierreId={deleteCierreId}
            onDeleted={() => setDeleteCierreId(null)}
          />
        )}
      </div>

      <GastoMenorDialog
        open={gastoDialogOpen}
        onOpenChange={setGastoDialogOpen}
        onSubmit={addGasto}
      />
    </div>
  );

  return (
    <Layout>
      <div className={`min-h-[50vh] ${isMobile ? "px-3 pt-2 pb-20" : ""}`}>
        {currentView === "main" && renderMainView()}
        {currentView === "financieros" && renderFinancierosView()}
        {currentView === "caja-menor" && renderCajaMenorView()}
        {currentView === "reporte-caja-menor" && renderReporteCajaMenorView()}
        {currentView === "aprobaciones" && (
          <div className="flex flex-col h-[calc(100vh-120px)] gap-4">
            <div className="flex items-center gap-4 flex-shrink-0">
              <Button variant="ghost" size="icon" onClick={() => setCurrentView("financieros")} className="shrink-0">
                <ArrowLeft className="w-5 h-5" />
              </Button>
              <div className="space-y-1">
                <h1 className="text-2xl font-bold text-foreground">Aprobaciones Pendientes</h1>
                <p className="text-muted-foreground">Solicitudes de presupuesto de todos los eventos</p>
              </div>
            </div>
            <div className="flex-1 min-h-0">
              <ErrorBoundary title="No se pudo cargar Aprobaciones Pendientes" description="Revisa los datos e intenta de nuevo." showDetails>
                <AprobacionesPendientes />
              </ErrorBoundary>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
};

export default PanelReportes;
