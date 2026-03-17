import { useAuth } from "@/contexts/AuthContext";
import { UserRole } from "@/types";

interface UseUserRoleReturn {
  role: UserRole | null;
  loading: boolean;
  roleLoading: boolean;
  roleError: string | null;
  allowedPanels: string[];
  canAccessPanel: (panel: string) => boolean;
  canEdit: () => boolean;
  canEditStructure: () => boolean;
  canEditOperaciones: () => boolean;
  canEditGeneral: () => boolean;
  canEditDirectivo: () => boolean;
  canEditPersonal: () => boolean;
  canEditInventario: () => boolean;
  canAsignarResponsables: () => boolean;
  isAdminOnly: (section: string) => boolean;
  canViewFeedback: () => boolean;
  canEditFeedback: () => boolean;
  canApproveCajaMenor: () => boolean;
  canCrearAnticipos: () => boolean;
  canRestaurarSolicitudes: () => boolean;
  canAjustarBaseCajaMenor: () => boolean;
  canAccessAdminPage: (page: string) => boolean;
  canDesembolsar: () => boolean;
  canAccessAprobaciones: () => boolean;
}

// Admin-only sections that require administrador role
const ADMIN_ONLY_SECTIONS = [
  "usuarios",
  "clientes", 
  "empleados",
  "constructor",
  "agentes",
  "directivo"
];

export function useUserRole(): UseUserRoleReturn {
  const { role, allowedPanels, loading, roleLoading, roleError, feedbackPermissions, cajaMenorPermissions, panelEditPermissions, adminPagePermissions } = useAuth();

  const canAccessPanel = (panel: string): boolean => {
    // If still loading, don't deny access yet
    if (roleLoading) return false;
    
    if (!role) return false;
    
    const normalizedRole = role.toLowerCase();
    const normalizedPanel = panel.toLowerCase();
    
    // Administrator has access to ALL panels
    if (normalizedRole === "administrador") {
      return true;
    }
    
    // Admin-only sections (except calendar which all roles can access)
    if (ADMIN_ONLY_SECTIONS.includes(normalizedPanel)) {
      return false;
    }
    
    // Google Calendar is accessible to all roles
    if (normalizedPanel === "calendar") {
      return true;
    }
    
    // For other panels, check allowed_panels array
    return allowedPanels.map(p => p.toLowerCase()).includes(normalizedPanel);
  };

  const canEdit = (): boolean => {
    if (!role) return false;
    const normalizedRole = role.toLowerCase();
    // Visual role is always read-only; admin and operativo CAN edit (but specific sections require granular permissions)
    return normalizedRole === "administrador" || normalizedRole === "operativo";
  };

  const canEditStructure = (): boolean => {
    if (!role) return false;
    return role.toLowerCase() === "administrador";
  };

  const isAdminOnly = (section: string): boolean => {
    return ADMIN_ONLY_SECTIONS.includes(section.toLowerCase());
  };

  // Can edit Panel General: requires explicit permission for ALL roles (including admin)
  const canEditGeneral = (): boolean => {
    if (!role) return false;
    const normalizedRole = role.toLowerCase();
    if (normalizedRole === "administrador") return panelEditPermissions?.puedeEditarGeneral ?? false;
    if (normalizedRole === "operativo") return panelEditPermissions?.puedeEditarGeneral ?? false;
    return false;
  };

  // Can edit operations panel: requires explicit permission for ALL roles
  const canEditOperaciones = (): boolean => {
    if (!role) return false;
    const normalizedRole = role.toLowerCase();
    if (normalizedRole === "administrador") return panelEditPermissions?.puedeEditarOperaciones ?? false;
    if (normalizedRole === "operativo") return panelEditPermissions?.puedeEditarOperaciones ?? false;
    return false;
  };

  // Can edit Panel Directivo: requires explicit permission for ALL roles
  const canEditDirectivo = (): boolean => {
    if (!role) return false;
    const normalizedRole = role.toLowerCase();
    if (normalizedRole === "administrador") return panelEditPermissions?.puedeEditarDirectivo ?? false;
    if (normalizedRole === "operativo") return panelEditPermissions?.puedeEditarDirectivo ?? false;
    return false;
  };

  const canViewFeedback = (): boolean => {
    if (!role) return false;
    return feedbackPermissions?.puedeVerFeedback ?? false;
  };

  const canEditFeedback = (): boolean => {
    if (!role) return false;
    return feedbackPermissions?.puedeEditarFeedback ?? false;
  };

  const canApproveCajaMenor = (): boolean => {
    if (!role) return false;
    return cajaMenorPermissions?.puedeAprobarCajaMenor ?? false;
  };

  const canCrearAnticipos = (): boolean => {
    if (!role) return false;
    return cajaMenorPermissions?.puedeCrearAnticipos ?? false;
  };

  const canEditPersonal = (): boolean => {
    if (!role) return false;
    const normalizedRole = role.toLowerCase();
    if (normalizedRole === "administrador" || normalizedRole === "operativo") {
      return panelEditPermissions?.puedeEditarPersonal ?? false;
    }
    return false;
  };

  const canEditInventario = (): boolean => {
    if (!role) return false;
    const normalizedRole = role.toLowerCase();
    if (normalizedRole === "administrador" || normalizedRole === "operativo") {
      return panelEditPermissions?.puedeEditarInventario ?? false;
    }
    return false;
  };

  const canAsignarResponsables = (): boolean => {
    if (!role) return false;
    const normalizedRole = role.toLowerCase();
    if (normalizedRole === "administrador" || normalizedRole === "operativo") {
      return panelEditPermissions?.puedeAsignarResponsables ?? false;
    }
    return false;
  };

  const canRestaurarSolicitudes = (): boolean => {
    if (!role) return false;
    if (role.toLowerCase() === "administrador") {
      return cajaMenorPermissions?.puedeRestaurarSolicitudes ?? false;
    }
    return false;
  };

  const canAjustarBaseCajaMenor = (): boolean => {
    if (!role) return false;
    if (role.toLowerCase() === "administrador") {
      return cajaMenorPermissions?.puedeAjustarBaseCajaMenor ?? false;
    }
    return false;
  };

  const canAccessAdminPage = (page: string): boolean => {
    if (!role) return false;
    if (role.toLowerCase() !== "administrador") return false;
    
    const pageMap: Record<string, boolean> = {
      usuarios: adminPagePermissions?.puedeAccederUsuarios ?? true,
      clientes: adminPagePermissions?.puedeAccederClientes ?? true,
      empleados: adminPagePermissions?.puedeAccederEmpleados ?? true,
      constructor: adminPagePermissions?.puedeAccederConstructor ?? true,
      agentes: adminPagePermissions?.puedeAccederAgentes ?? true,
    };
    
    return pageMap[page.toLowerCase()] ?? false;
  };

  return {
    role: role as UserRole | null,
    loading,
    roleLoading,
    roleError,
    allowedPanels,
    canAccessPanel,
    canEdit,
    canEditStructure,
    canEditOperaciones,
    canEditGeneral,
    canEditDirectivo,
    canEditPersonal,
    canEditInventario,
    canAsignarResponsables,
    isAdminOnly,
    canViewFeedback,
    canEditFeedback,
    canApproveCajaMenor,
    canCrearAnticipos,
    canRestaurarSolicitudes,
    canAjustarBaseCajaMenor,
    canAccessAdminPage,
  };
}
