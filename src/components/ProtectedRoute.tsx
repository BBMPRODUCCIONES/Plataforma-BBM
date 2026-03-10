import { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useUserRole } from "@/hooks/useUserRole";
import { AlertCircle, Loader2, RefreshCw, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import Layout from "@/components/Layout";

interface ProtectedRouteProps {
  children: ReactNode;
  requiredPanel?: string;
  adminOnly?: boolean;
  adminPage?: string; // granular admin page permission key
}

export function ProtectedRoute({ children, requiredPanel, adminOnly = false, adminPage }: ProtectedRouteProps) {
  const { user, loading: authLoading, roleLoading, roleError, signOut, refreshUserRole } = useAuth();
  const { role, canAccessPanel, canEditStructure, canAccessAdminPage } = useUserRole();

  // Show loading while checking BOTH auth AND role
  if (authLoading || roleLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-background">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <span className="text-sm text-muted-foreground">Cargando permisos...</span>
        </div>
      </div>
    );
  }

  // Redirect to login if not authenticated
  if (!user) {
    return <Navigate to="/" replace />;
  }

  // Handle timeout error - allow retry
  if (roleError === "timeout") {
    return (
      <Layout>
        <div className="flex items-center justify-center h-[60vh]">
          <div className="text-center space-y-4">
            <AlertCircle className="h-12 w-12 text-warning mx-auto" />
            <h2 className="text-xl font-semibold">Error de Conexión</h2>
            <p className="text-muted-foreground">
              No se pudieron cargar los permisos. Verifica tu conexión e intenta nuevamente.
            </p>
            <div className="flex gap-2 justify-center">
              <Button onClick={refreshUserRole} variant="default">
                <RefreshCw className="h-4 w-4 mr-2" />
                Reintentar
              </Button>
              <Button onClick={signOut} variant="outline">
                <LogOut className="h-4 w-4 mr-2" />
                Cerrar sesión
              </Button>
            </div>
          </div>
        </div>
      </Layout>
    );
  }

  // Handle user without role assignment (orphaned user)
  if (roleError === "no_role" || (!role && !roleLoading)) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-[60vh]">
          <div className="text-center space-y-4">
            <AlertCircle className="h-12 w-12 text-warning mx-auto" />
            <h2 className="text-xl font-semibold">Cuenta Incompleta</h2>
            <p className="text-muted-foreground">
              Tu cuenta no tiene un rol asignado. Contacta al administrador para que te asigne permisos.
            </p>
            <Button onClick={signOut} variant="outline">
              <LogOut className="h-4 w-4 mr-2" />
              Cerrar sesión
            </Button>
          </div>
        </div>
      </Layout>
    );
  }

  // At this point, we have a valid role - check permissions
  
  // Check admin-only routes
  if (adminOnly && !canEditStructure()) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-[60vh]">
          <div className="text-center space-y-4">
            <AlertCircle className="h-12 w-12 text-destructive mx-auto" />
            <h2 className="text-xl font-semibold">Acceso Denegado</h2>
            <p className="text-muted-foreground">
              Solo los administradores pueden acceder a esta sección.
            </p>
          </div>
        </div>
      </Layout>
    );
  }

  // Check panel access
  if (requiredPanel && !canAccessPanel(requiredPanel)) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-[60vh]">
          <div className="text-center space-y-4">
            <AlertCircle className="h-12 w-12 text-destructive mx-auto" />
            <h2 className="text-xl font-semibold">Acceso Denegado</h2>
            <p className="text-muted-foreground">
              No tienes permiso para acceder a este panel.
            </p>
          </div>
        </div>
      </Layout>
    );
  }

  return <>{children}</>;
}
