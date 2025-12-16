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
  isAdminOnly: (section: string) => boolean;
  canViewFeedback: () => boolean;
  canEditFeedback: () => boolean;
  canApproveCajaMenor: () => boolean;
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
  const { role, allowedPanels, loading, roleLoading, roleError, feedbackPermissions, cajaMenorPermissions } = useAuth();

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
    // Visual role is read-only
    return normalizedRole === "administrador" || normalizedRole === "operativo";
  };

  const canEditStructure = (): boolean => {
    if (!role) return false;
    return role.toLowerCase() === "administrador";
  };

  const isAdminOnly = (section: string): boolean => {
    return ADMIN_ONLY_SECTIONS.includes(section.toLowerCase());
  };

  const canViewFeedback = (): boolean => {
    if (!role) return false;
    // Administrador always has access
    if (role.toLowerCase() === "administrador") return true;
    // For other roles, check specific permission
    return feedbackPermissions?.puedeVerFeedback ?? false;
  };

  const canEditFeedback = (): boolean => {
    if (!role) return false;
    // Administrador always has full access
    if (role.toLowerCase() === "administrador") return true;
    // For other roles, check specific permission
    return feedbackPermissions?.puedeEditarFeedback ?? false;
  };

  const canApproveCajaMenor = (): boolean => {
    if (!role) return false;
    // Administrador with permission flag OR explicit permission
    if (role.toLowerCase() === "administrador") {
      // Admin also needs explicit permission unless they have it
      return cajaMenorPermissions?.puedeAprobarCajaMenor ?? false;
    }
    // For other roles, permission is NOT available
    return false;
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
    isAdminOnly,
    canViewFeedback,
    canEditFeedback,
    canApproveCajaMenor,
  };
}
