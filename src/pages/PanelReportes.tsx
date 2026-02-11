import { useState } from "react";
import Layout from "@/components/Layout";
import { FileBarChart, DollarSign, ArrowLeft, Wallet, ClipboardCheck, Receipt } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import ReporteCajaMenor from "@/components/reports/ReporteCajaMenor";
import AprobacionesPendientes from "@/components/reports/AprobacionesPendientes";
import { useIsMobile } from "@/hooks/use-mobile";
import ErrorBoundary from "@/components/ErrorBoundary";

type ReportView = "main" | "financieros" | "caja-menor" | "reporte-caja-menor" | "aprobaciones";

const PanelReportes = () => {
  const [currentView, setCurrentView] = useState<ReportView>("main");
  const isMobile = useIsMobile();

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
      <div className="flex items-center gap-4 flex-shrink-0">
        <Button variant="ghost" size="icon" onClick={() => setCurrentView("financieros")} className="shrink-0">
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div className="space-y-1">
          <h1 className="text-2xl font-bold text-foreground">Reporte de Caja Menor</h1>
          <p className="text-muted-foreground">Control y seguimiento de movimientos</p>
        </div>
      </div>
      <div className="flex-1 min-h-0 flex items-center justify-center">
        <p className="text-muted-foreground">Próximamente disponible</p>
      </div>
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
