import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

type AppRole = Database["public"]["Enums"]["app_role"];

interface FeedbackPermissions {
  puedeVerFeedback: boolean;
  puedeEditarFeedback: boolean;
}

interface UserRoleData {
  role: AppRole;
  allowedPanels: string[];
  feedbackPermissions: FeedbackPermissions;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  role: AppRole | null;
  allowedPanels: string[];
  feedbackPermissions: FeedbackPermissions;
  loading: boolean;
  roleLoading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  refreshUserRole: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const defaultFeedbackPermissions: FeedbackPermissions = {
  puedeVerFeedback: false,
  puedeEditarFeedback: false,
};

// Cache key for localStorage
const ROLE_CACHE_KEY = "bbm_user_role_cache";

interface CachedRoleData {
  userId: string;
  role: AppRole;
  allowedPanels: string[];
  feedbackPermissions: FeedbackPermissions;
  timestamp: number;
}

// Cache duration: 5 minutes
const CACHE_DURATION = 5 * 60 * 1000;

function getCachedRole(userId: string): UserRoleData | null {
  try {
    const cached = localStorage.getItem(ROLE_CACHE_KEY);
    if (!cached) return null;
    
    const data: CachedRoleData = JSON.parse(cached);
    
    // Check if cache is for this user and not expired
    if (data.userId === userId && (Date.now() - data.timestamp) < CACHE_DURATION) {
      return {
        role: data.role,
        allowedPanels: data.allowedPanels,
        feedbackPermissions: data.feedbackPermissions,
      };
    }
    
    // Clear stale cache
    localStorage.removeItem(ROLE_CACHE_KEY);
    return null;
  } catch {
    localStorage.removeItem(ROLE_CACHE_KEY);
    return null;
  }
}

function setCachedRole(userId: string, roleData: UserRoleData): void {
  try {
    const cacheData: CachedRoleData = {
      userId,
      role: roleData.role,
      allowedPanels: roleData.allowedPanels,
      feedbackPermissions: roleData.feedbackPermissions,
      timestamp: Date.now(),
    };
    localStorage.setItem(ROLE_CACHE_KEY, JSON.stringify(cacheData));
  } catch {
    // Ignore localStorage errors
  }
}

function clearCachedRole(): void {
  try {
    localStorage.removeItem(ROLE_CACHE_KEY);
  } catch {
    // Ignore localStorage errors
  }
}

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [role, setRole] = useState<AppRole | null>(null);
  const [allowedPanels, setAllowedPanels] = useState<string[]>([]);
  const [feedbackPermissions, setFeedbackPermissions] = useState<FeedbackPermissions>(defaultFeedbackPermissions);
  const [loading, setLoading] = useState(true);
  const [roleLoading, setRoleLoading] = useState(true);

  const fetchUserRole = async (userId: string): Promise<UserRoleData | null> => {
    const { data, error } = await supabase
      .from("user_roles")
      .select("role, allowed_panels, puede_ver_feedback, puede_editar_feedback")
      .eq("user_id", userId)
      .maybeSingle();

    if (error) {
      console.error("Error fetching user role:", error);
      return null;
    }
    
    if (!data) return null;
    
    const roleData: UserRoleData = {
      role: data.role,
      allowedPanels: data.allowed_panels || [],
      feedbackPermissions: {
        puedeVerFeedback: data.puede_ver_feedback ?? false,
        puedeEditarFeedback: data.puede_editar_feedback ?? false,
      }
    };
    
    // Cache the role data
    setCachedRole(userId, roleData);
    
    return roleData;
  };

  const applyRoleData = (roleData: UserRoleData | null) => {
    if (roleData) {
      setRole(roleData.role);
      setAllowedPanels(roleData.allowedPanels);
      setFeedbackPermissions(roleData.feedbackPermissions);
    } else {
      setRole(null);
      setAllowedPanels([]);
      setFeedbackPermissions(defaultFeedbackPermissions);
    }
  };

  const refreshUserRole = async () => {
    if (user) {
      setRoleLoading(true);
      const roleData = await fetchUserRole(user.id);
      applyRoleData(roleData);
      setRoleLoading(false);
    }
  };

  useEffect(() => {
    let isMounted = true;

    const initializeAuth = async () => {
      // Set up auth state listener FIRST
      const { data: { subscription } } = supabase.auth.onAuthStateChange(
        async (event, session) => {
          if (!isMounted) return;
          
          setSession(session);
          setUser(session?.user ?? null);
          
          if (session?.user) {
            // First, try to use cached role for instant UI
            const cachedRole = getCachedRole(session.user.id);
            if (cachedRole) {
              applyRoleData(cachedRole);
              setRoleLoading(false);
              setLoading(false);
              
              // Then refresh from DB in background (non-blocking)
              setTimeout(async () => {
                if (isMounted) {
                  const freshRole = await fetchUserRole(session.user.id);
                  if (isMounted && freshRole) {
                    applyRoleData(freshRole);
                  }
                }
              }, 0);
            } else {
              // No cache, must wait for DB fetch
              setRoleLoading(true);
              const roleData = await fetchUserRole(session.user.id);
              if (isMounted) {
                applyRoleData(roleData);
                setRoleLoading(false);
                setLoading(false);
              }
            }
          } else {
            // No session - clear everything
            applyRoleData(null);
            clearCachedRole();
            setRoleLoading(false);
            setLoading(false);
          }
        }
      );

      // THEN check for existing session
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!isMounted) return;
      
      setSession(session);
      setUser(session?.user ?? null);
      
      if (session?.user) {
        // Try cached role first for fast initial render
        const cachedRole = getCachedRole(session.user.id);
        if (cachedRole) {
          applyRoleData(cachedRole);
          setRoleLoading(false);
          setLoading(false);
          
          // Refresh from DB in background
          const freshRole = await fetchUserRole(session.user.id);
          if (isMounted && freshRole) {
            applyRoleData(freshRole);
          }
        } else {
          // No cache, wait for fetch
          const roleData = await fetchUserRole(session.user.id);
          if (isMounted) {
            applyRoleData(roleData);
            setRoleLoading(false);
            setLoading(false);
          }
        }
      } else {
        setRoleLoading(false);
        setLoading(false);
      }

      return () => subscription.unsubscribe();
    };

    initializeAuth();

    return () => {
      isMounted = false;
    };
  }, []);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    return { error };
  };

  const signOut = async () => {
    clearCachedRole();
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    setRole(null);
    setAllowedPanels([]);
    setFeedbackPermissions(defaultFeedbackPermissions);
  };

  return (
    <AuthContext.Provider value={{ 
      user, 
      session, 
      role, 
      allowedPanels,
      feedbackPermissions,
      loading, 
      roleLoading,
      signIn, 
      signOut,
      refreshUserRole 
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
