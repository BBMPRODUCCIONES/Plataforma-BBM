import { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useUserRole } from "@/hooks/useUserRole";
import { AlertCircle, Loader2 } from "lucide-react";
import Layout from "@/components/Layout";

interface ProtectedRouteProps {
  children: ReactNode;
  requiredPanel?: string;
  adminOnly?: boolean;
}

export function ProtectedRoute({ children, requiredPanel, adminOnly = false }: ProtectedRouteProps) {
  const { user, loading: authLoading, roleLoading } = useAuth();
  const { role, canAccessPanel, canEditStructure } = useUserRole();

  // Show loading while checking BOTH auth AND role
  // This is critical - we must wait for role before showing access denied
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

  // Only check permissions AFTER role is confirmed loaded
  // At this point, roleLoading is false, so role should be available
  
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
