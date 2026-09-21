import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { EmpleadosProvider } from "@/contexts/EmpleadosContext";
import { ProjectsProvider } from "@/contexts/ProjectsContext";
import { ClientesProvider } from "@/contexts/ClientesContext";
import { ProveedoresProvider } from "@/contexts/ProveedoresContext";
import { DateRangeProvider } from "@/contexts/DateRangeContext";
import { HorariosProvider } from "@/contexts/HorariosContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import ErrorBoundary from "@/components/ErrorBoundary";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import CrearCuenta from "./pages/CrearCuenta";
import PanelDirectivo from "./pages/PanelDirectivo";
import PanelGeneral from "./pages/PanelGeneral";
import PanelOperaciones from "./pages/PanelOperaciones";
import Proveedores from "./pages/Proveedores";
import HistorialCotizaciones from "./pages/HistorialCotizaciones";
import Constructor from "./pages/Constructor";
import AgentesIA from "./pages/AgentesIA";
import GoogleCalendar from "./pages/GoogleCalendar";
import Usuarios from "./pages/Usuarios";
import Clientes from "./pages/Clientes";
import Empleados from "./pages/Empleados";
import NotFound from "./pages/NotFound";
import InstalarApp from "./pages/InstalarApp";

import PanelReportes from "./pages/PanelReportes";
import PanelVentas from "./pages/PanelVentas";
import PlanoLed from "./pages/PlanoLed";

const queryClient = new QueryClient();

const App = () => (
  <ErrorBoundary title="Error inesperado" description="Algo salió mal. Intenta recargar la página." showDetails>
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <AuthProvider>
        <ProjectsProvider>
          <EmpleadosProvider>
          <HorariosProvider>
          <ClientesProvider>
            <ProveedoresProvider>
              <DateRangeProvider>
              <Toaster />
              <Sonner />
              <BrowserRouter>
                <Routes>
                  {/* Public routes */}
                  <Route path="/" element={<Index />} />
                  <Route path="/auth" element={<Auth />} />
                  <Route path="/crear-cuenta" element={<CrearCuenta />} />
                  <Route path="/instalar" element={<InstalarApp />} />

                  {/* Panel routes with access control */}
                  <Route path="/panel-directivo" element={
                    <ProtectedRoute requiredPanel="directivo" adminOnly>
                      <PanelDirectivo />
                    </ProtectedRoute>
                  } />
                  <Route path="/panel-general" element={
                    <ProtectedRoute requiredPanel="general">
                      <PanelGeneral />
                    </ProtectedRoute>
                  } />
                  <Route path="/panel-operaciones" element={
                    <ProtectedRoute requiredPanel="operaciones">
                      <PanelOperaciones />
                    </ProtectedRoute>
                  } />
                  <Route path="/proveedores" element={
                    <ProtectedRoute requiredPanel="proveedores">
                      <Proveedores />
                    </ProtectedRoute>
                  } />
                  <Route path="/historial-cotizaciones" element={
                    <ProtectedRoute requiredPanel="proveedores">
                      <HistorialCotizaciones />
                    </ProtectedRoute>
                  } />
                  {/* Plano LED - lo ve cualquiera que entre; sin requiredPanel,
                      porque no es un panel de gestion sino una herramienta. */}
                  <Route path="/plano-led-herramienta" element={
                    <ProtectedRoute>
                      <PlanoLed />
                    </ProtectedRoute>
                  } />

                  {/* Ventas por comercial - ocupa el lugar que tenia Reportes en el menu */}
                  <Route path="/panel-ventas" element={
                    <ProtectedRoute requiredPanel="directivo">
                      <PanelVentas />
                    </ProtectedRoute>
                  } />

                  {/* Panel de Reportes - Admin only */}
                  <Route path="/panel-reportes" element={
                    <ProtectedRoute adminOnly>
                      <PanelReportes />
                    </ProtectedRoute>
                  } />

                  {/* Admin-only routes with per-page permissions */}
                  <Route path="/usuarios" element={
                    <ProtectedRoute adminOnly adminPage="usuarios">
                      <Usuarios />
                    </ProtectedRoute>
                  } />
                  <Route path="/clientes" element={
                    <ProtectedRoute adminOnly adminPage="clientes">
                      <Clientes />
                    </ProtectedRoute>
                  } />
                  <Route path="/empleados" element={
                    <ProtectedRoute adminOnly adminPage="empleados">
                      <Empleados />
                    </ProtectedRoute>
                  } />
                  <Route path="/constructor" element={
                    <ProtectedRoute adminOnly adminPage="constructor">
                      <Constructor />
                    </ProtectedRoute>
                  } />
                  <Route path="/agentes-ia" element={
                    <ProtectedRoute adminOnly adminPage="agentes">
                      <AgentesIA />
                    </ProtectedRoute>
                  } />

                  {/* Google Calendar - accessible to all authenticated users */}
                  <Route path="/calendar" element={
                    <ProtectedRoute requiredPanel="calendar">
                      <GoogleCalendar />
                    </ProtectedRoute>
                  } />

                  <Route path="*" element={<NotFound />} />
                </Routes>
              </BrowserRouter>
              </DateRangeProvider>
            </ProveedoresProvider>
            </ClientesProvider>
          </HorariosProvider>
          </EmpleadosProvider>
        </ProjectsProvider>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
  </ErrorBoundary>
);

export default App;
