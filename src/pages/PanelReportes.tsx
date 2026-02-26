import { useState } from "react";
import Layout from "@/components/Layout";
import { FileBarChart, DollarSign, ArrowLeft, Wallet, ClipboardCheck, Receipt, Plus, Trash2, UserCheck, Lock, RotateCcw } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import ReporteCajaMenor from "@/components/reports/ReporteCajaMenor";
import AprobacionesPendientes from "@/components/reports/AprobacionesPendientes";
import GastoMenorDialog from "@/components/reports/GastoMenorDialog";
import { useIsMobile } from "@/hooks/use-mobile";
import { useGastosMenores } from "@/hooks/useGastosMenores";
import { useCajaMenorConfig } from "@/hooks/useCajaMenorConfig";
import ErrorBoundary from "@/components/ErrorBoundary";
import GastosMenoresKPIs from "@/components/reports/GastosMenoresKPIs";
import { CajaMenorEstadoSelect } from "@/components/CajaMenorEstadoSelect";
import { useUserRole } from "@/hooks/useUserRole";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { toast } from "sonner";

type ReportView = "main" | "financieros" | "caja-menor" | "reporte-caja-menor" | "aprobaciones";

const PanelReportes = () => {
  const [currentView, setCurrentView] = useState<ReportView>("main");
  const [gastoDialogOpen, setGastoDialogOpen] = useState(false);
  const isMobile = useIsMobile();
  const { gastos, loading, addGasto, deleteGasto } = useGastosMenores();
  const { config, cierres, stats, updateBase, registerResponsable, realizarCierre } = useCajaMenorConfig(gastos);
  const { canApproveCajaMenor, role } = useUserRole();
  const isAdmin = role === "administrador";
  const [editingBase, setEditingBase] = useState(false);
  const [baseInput, setBaseInput] = useState("");

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
        <Button onClick={() => setGastoDialogOpen(true)} size="sm">
          <Plus className="h-4 w-4 mr-1" />
          Agregar Gasto
        </Button>
      </div>

      <div className="flex-1 min-h-0 overflow-auto space-y-4">
        {/* Estado de Caja Menor - Dashboard */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {/* Base Asignada */}
          <Card className="border-primary/20">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs text-muted-foreground font-medium">Base Asignada</p>
                {isAdmin && (
                  <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={() => {
                    setEditingBase(!editingBase);
                    setBaseInput(String(stats.base || ""));
                  }}>
                    {editingBase ? "Cancelar" : "Editar"}
                  </Button>
                )}
              </div>
              {editingBase ? (
                <div className="flex gap-2">
                  <Input
                    type="number"
                    value={baseInput}
                    onChange={(e) => setBaseInput(e.target.value)}
                    className="h-8 text-sm"
                    placeholder="0"
                  />
                  <Button size="sm" className="h-8" onClick={async () => {
                    if (await updateBase(Number(baseInput))) setEditingBase(false);
                  }}>OK</Button>
                </div>
              ) : (
                <p className="text-xl font-bold">{new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", minimumFractionDigits: 0 }).format(stats.base)}</p>
              )}
            </CardContent>
          </Card>

          {/* Persona Responsable */}
          <Card className="border-border/50">
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground font-medium mb-2">Persona Responsable</p>
              {config?.responsable_nombre ? (
                <div className="flex items-center gap-2">
                  <UserCheck className="h-4 w-4 text-emerald-500" />
                  <div>
                    <p className="text-sm font-medium">{config.responsable_nombre}</p>
                    {config.responsable_timestamp && (
                      <p className="text-[10px] text-muted-foreground">
                        {format(new Date(config.responsable_timestamp), "dd/MM/yyyy HH:mm", { locale: es })}
                      </p>
                    )}
                  </div>
                </div>
              ) : (
                <Button variant="outline" size="sm" onClick={registerResponsable} className="w-full">
                  <UserCheck className="h-4 w-4 mr-1" /> Registrarme
                </Button>
              )}
            </CardContent>
          </Card>

          {/* Cierre de Caja */}
          <Card className="border-border/50">
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground font-medium mb-2">Cierre de Caja</p>
              <p className="text-sm mb-2">
                Estado: <span className="font-medium">{config?.estado_cierre || "Abierta"}</span>
              </p>
              {isAdmin && (
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" className="text-xs flex-1" onClick={() => realizarCierre("Legalizado")}>
                    <Lock className="h-3 w-3 mr-1" /> Legalizar
                  </Button>
                  <Button variant="outline" size="sm" className="text-xs flex-1" onClick={() => realizarCierre("Reembolsado")}>
                    <RotateCcw className="h-3 w-3 mr-1" /> Reembolsar
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* KPIs */}
        <GastosMenoresKPIs gastos={gastos} baseAsignada={stats.base} />

        {/* Gastos Table */}
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
                <TableHead>Fecha</TableHead>
                <TableHead>Centro de Costos</TableHead>
                <TableHead>Concepto</TableHead>
                <TableHead>Categoría</TableHead>
                <TableHead>Nombre Comercio</TableHead>
                <TableHead>NIT/CC</TableHead>
                <TableHead className="text-right">Valor</TableHead>
                <TableHead>Imagen</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Aprobado por</TableHead>
                <TableHead className="w-[50px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {gastos.map((g) => (
                <TableRow key={g.id}>
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
                    {canApproveCajaMenor() ? (
                      <CajaMenorEstadoSelect value={g.estado} onChange={(v) => handleEstadoChange(g.id, v)} />
                    ) : (
                      <CajaMenorEstadoSelect value={g.estado} onChange={() => {}} readOnly />
                    )}
                  </TableCell>
                  <TableCell className="text-xs whitespace-nowrap">{g.aprobado_por_nombre || "—"}</TableCell>
                  <TableCell>
                    {canApproveCajaMenor() && g.estado !== "Aprobado" && g.estado !== "Legalizado" && g.estado !== "Reembolsado" && (
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

        {/* Historial de Cierres */}
        {cierres.length > 0 && (
          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-muted-foreground">Historial de Cierres de Caja</h3>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha Cierre</TableHead>
                  <TableHead>Responsable</TableHead>
                  <TableHead className="text-right">Valor Total</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Cambios Base</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {cierres.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="text-xs">{format(new Date(c.fecha_cierre), "dd/MM/yyyy HH:mm", { locale: es })}</TableCell>
                    <TableCell className="text-xs">{c.responsable_nombre}</TableCell>
                    <TableCell className="text-xs text-right font-mono">$ {c.valor_total.toLocaleString("es-CO")}</TableCell>
                    <TableCell>
                      <CajaMenorEstadoSelect value={c.estado} onChange={() => {}} readOnly />
                    </TableCell>
                    <TableCell className="text-xs">{c.cambios_base || "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
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
