import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { EmpleadosProvider } from "@/contexts/EmpleadosContext";
import { ProjectsProvider } from "@/contexts/ProjectsContext";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import CrearCuenta from "./pages/CrearCuenta";
import PanelDirectivo from "./pages/PanelDirectivo";
import PanelGeneral from "./pages/PanelGeneral";
import PanelOperaciones from "./pages/PanelOperaciones";
import Proveedores from "./pages/Proveedores";
import Constructor from "./pages/Constructor";
import AgentesIA from "./pages/AgentesIA";
import GoogleCalendar from "./pages/GoogleCalendar";
import Usuarios from "./pages/Usuarios";
import Clientes from "./pages/Clientes";
import Empleados from "./pages/Empleados";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <AuthProvider>
        <ProjectsProvider>
          <EmpleadosProvider>
            <Toaster />
            <Sonner />
            <BrowserRouter>
              <Routes>
                <Route path="/" element={<Index />} />
                <Route path="/auth" element={<Auth />} />
                <Route path="/crear-cuenta" element={<CrearCuenta />} />
                <Route path="/panel-directivo" element={<PanelDirectivo />} />
                <Route path="/panel-general" element={<PanelGeneral />} />
                <Route path="/panel-operaciones" element={<PanelOperaciones />} />
                <Route path="/proveedores" element={<Proveedores />} />
                <Route path="/constructor" element={<Constructor />} />
                <Route path="/agentes-ia" element={<AgentesIA />} />
                <Route path="/calendar" element={<GoogleCalendar />} />
                <Route path="/usuarios" element={<Usuarios />} />
                <Route path="/clientes" element={<Clientes />} />
                <Route path="/empleados" element={<Empleados />} />
                <Route path="*" element={<NotFound />} />
              </Routes>
            </BrowserRouter>
          </EmpleadosProvider>
        </ProjectsProvider>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
