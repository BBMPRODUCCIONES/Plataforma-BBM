import { useState, useEffect } from "react";
import { UserRole } from "@/types";
import { currentUser } from "@/data/mockData";

interface UseUserRoleReturn {
  role: UserRole | null;
  loading: boolean;
  canAccessPanel: (panel: string) => boolean;
  canEdit: () => boolean;
  canEditStructure: () => boolean;
}

export function useUserRole(): UseUserRoleReturn {
  const [role, setRole] = useState<UserRole | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Simulate fetching user role - in production this would come from auth
    const fetchRole = async () => {
      await new Promise((resolve) => setTimeout(resolve, 300));
      setRole(currentUser.role);
      setLoading(false);
    };
    fetchRole();
  }, []);

  const canAccessPanel = (panel: string): boolean => {
    if (!role) return false;
    
    // Normalize role to lowercase for safe comparison
    const normalizedRole = role.toLowerCase();
    
    // Administrator has access to ALL panels
    if (normalizedRole === "administrador") {
      return true;
    }
    
    // Operativo can access general and operaciones
    if (normalizedRole === "operativo") {
      const allowedPanels = ["general", "operaciones", "proveedores"];
      return allowedPanels.includes(panel.toLowerCase());
    }
    
    // Visual can access all panels but read-only
    if (normalizedRole === "visual") {
      const allowedPanels = ["directivo", "general", "operaciones", "proveedores"];
      return allowedPanels.includes(panel.toLowerCase());
    }
    
    return false;
  };

  const canEdit = (): boolean => {
    if (!role) return false;
    const normalizedRole = role.toLowerCase();
    return normalizedRole === "administrador" || normalizedRole === "operativo";
  };

  const canEditStructure = (): boolean => {
    if (!role) return false;
    return role.toLowerCase() === "administrador";
  };

  return {
    role,
    loading,
    canAccessPanel,
    canEdit,
    canEditStructure,
  };
}
