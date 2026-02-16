import { createContext, useContext, useEffect, useState, ReactNode, useRef } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { initOneSignal, setExternalUserId, removeExternalUserId, promptForPushPermission } from "@/lib/onesignal";

type AppRole = Database["public"]["Enums"]["app_role"];

interface FeedbackPermissions {
  puedeVerFeedback: boolean;
  puedeEditarFeedback: boolean;
}

interface CajaMenorPermissions {
  puedeAprobarCajaMenor: boolean;
  puedeCrearAnticipos: boolean;
}

interface UserRoleData {
  role: AppRole;
  allowedPanels: string[];
  feedbackPermissions: FeedbackPermissions;
  cajaMenorPermissions: CajaMenorPermissions;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  role: AppRole | null;
  allowedPanels: string[];
  feedbackPermissions: FeedbackPermissions;
  cajaMenorPermissions: CajaMenorPermissions;
  loading: boolean;
  roleLoading: boolean;
  roleError: string | null;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  refreshUserRole: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const defaultFeedbackPermissions: FeedbackPermissions = {
  puedeVerFeedback: false,
  puedeEditarFeedback: false,
};

const defaultCajaMenorPermissions: CajaMenorPermissions = {
  puedeAprobarCajaMenor: false,
  puedeCrearAnticipos: false,
};

// Cache key for localStorage
const ROLE_CACHE_KEY = "bbm_user_role_cache";

interface CachedRoleData {
  userId: string;
  role: AppRole;
  allowedPanels: string[];
  feedbackPermissions: FeedbackPermissions;
  cajaMenorPermissions: CajaMenorPermissions;
  timestamp: number;
}

// Cache duration: 5 minutes
const CACHE_DURATION = 5 * 60 * 1000;

// Timeout for role fetch: 5 seconds
const ROLE_FETCH_TIMEOUT = 5000;

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
        cajaMenorPermissions: data.cajaMenorPermissions || { puedeAprobarCajaMenor: false, puedeCrearAnticipos: false },
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
      cajaMenorPermissions: roleData.cajaMenorPermissions,
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
  const [cajaMenorPermissions, setCajaMenorPermissions] = useState<CajaMenorPermissions>(defaultCajaMenorPermissions);
  const [loading, setLoading] = useState(true);
  const [roleLoading, setRoleLoading] = useState(true);
  const [roleError, setRoleError] = useState<string | null>(null);
  
  // Prevent duplicate initialization
  const initializingRef = useRef(false);
  const initializedRef = useRef(false);

  const fetchUserRole = async (userId: string): Promise<UserRoleData | null> => {
    try {
      const { data, error } = await supabase
        .from("user_roles")
        .select("role, allowed_panels, puede_ver_feedback, puede_editar_feedback, puede_aprobar_caja_menor, puede_crear_anticipos")
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
        },
        cajaMenorPermissions: {
          puedeAprobarCajaMenor: data.puede_aprobar_caja_menor ?? false,
          puedeCrearAnticipos: data.puede_crear_anticipos ?? false,
        }
      };
      
      // Cache the role data
      setCachedRole(userId, roleData);
      
      return roleData;
    } catch (error) {
      console.error("Exception fetching user role:", error);
      return null;
    }
  };

  // Fetch with timeout to prevent hanging
  const fetchUserRoleWithTimeout = async (userId: string): Promise<{ data: UserRoleData | null; timedOut: boolean }> => {
    return new Promise((resolve) => {
      const timeout = setTimeout(() => {
        resolve({ data: null, timedOut: true });
      }, ROLE_FETCH_TIMEOUT);

      fetchUserRole(userId).then((data) => {
        clearTimeout(timeout);
        resolve({ data, timedOut: false });
      }).catch(() => {
        clearTimeout(timeout);
        resolve({ data: null, timedOut: false });
      });
    });
  };

  const applyRoleData = (roleData: UserRoleData | null) => {
    if (roleData) {
      setRole(roleData.role);
      setAllowedPanels(roleData.allowedPanels);
      setFeedbackPermissions(roleData.feedbackPermissions);
      setCajaMenorPermissions(roleData.cajaMenorPermissions);
      setRoleError(null);
    } else {
      setRole(null);
      setAllowedPanels([]);
      setFeedbackPermissions(defaultFeedbackPermissions);
      setCajaMenorPermissions(defaultCajaMenorPermissions);
    }
  };

  const refreshUserRole = async () => {
    if (user) {
      setRoleLoading(true);
      setRoleError(null);
      const { data, timedOut } = await fetchUserRoleWithTimeout(user.id);
      applyRoleData(data);
      if (timedOut) {
        setRoleError("timeout");
      } else if (!data) {
        setRoleError("no_role");
      }
      setRoleLoading(false);
    }
  };

  useEffect(() => {
    // Prevent duplicate initialization
    if (initializingRef.current || initializedRef.current) return;
    initializingRef.current = true;

    let isMounted = true;

    // Initialize OneSignal early (before auth check)
    initOneSignal().catch(e => console.error("[Auth] OneSignal init error:", e));

    const initializeAuth = async () => {
      // Set up auth state listener FIRST
      const { data: { subscription } } = supabase.auth.onAuthStateChange(
        (event, currentSession) => {
          if (!isMounted) return;
          
          // Clear cache on sign out or token issues
          if (event === 'SIGNED_OUT' || event === 'TOKEN_REFRESHED') {
            clearCachedRole();
          }
          
          setSession(currentSession);
          setUser(currentSession?.user ?? null);
          
          if (currentSession?.user) {
            // Link user to OneSignal when session exists
            setExternalUserId(currentSession.user.id).catch(e => 
              console.error("[Auth] OneSignal link error:", e)
            );
            
            // Use setTimeout to prevent Supabase deadlock
            setTimeout(async () => {
              if (!isMounted) return;
              
              // First, try to use cached role for instant UI
              const cachedRole = getCachedRole(currentSession.user.id);
              if (cachedRole) {
                applyRoleData(cachedRole);
                setRoleLoading(false);
                setLoading(false);
                
                // Then refresh from DB in background (non-blocking)
                const { data: freshRole } = await fetchUserRoleWithTimeout(currentSession.user.id);
                if (isMounted && freshRole) {
                  applyRoleData(freshRole);
                }
              } else {
                // No cache, must wait for DB fetch
                setRoleLoading(true);
                const { data: roleData, timedOut } = await fetchUserRoleWithTimeout(currentSession.user.id);
                if (isMounted) {
                  applyRoleData(roleData);
                  if (timedOut) {
                    setRoleError("timeout");
                  } else if (!roleData) {
                    setRoleError("no_role");
                  }
                  setRoleLoading(false);
                  setLoading(false);
                }
              }
            }, 0);
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
      const { data: { session: existingSession } } = await supabase.auth.getSession();
      
      if (!isMounted) return;
      
      setSession(existingSession);
      setUser(existingSession?.user ?? null);
      
      if (existingSession?.user) {
        // Link existing user to OneSignal
        setExternalUserId(existingSession.user.id).catch(e => 
          console.error("[Auth] OneSignal link error:", e)
        );
        
        // Try cached role first for fast initial render
        const cachedRole = getCachedRole(existingSession.user.id);
        if (cachedRole) {
          applyRoleData(cachedRole);
          setRoleLoading(false);
          setLoading(false);
          
          // Refresh from DB in background
          const { data: freshRole } = await fetchUserRoleWithTimeout(existingSession.user.id);
          if (isMounted && freshRole) {
            applyRoleData(freshRole);
          }
        } else {
          // No cache, wait for fetch with timeout
          const { data: roleData, timedOut } = await fetchUserRoleWithTimeout(existingSession.user.id);
          if (isMounted) {
            applyRoleData(roleData);
            if (timedOut) {
              setRoleError("timeout");
            } else if (!roleData) {
              setRoleError("no_role");
            }
            setRoleLoading(false);
            setLoading(false);
          }
        }
      } else {
        setRoleLoading(false);
        setLoading(false);
      }

      initializedRef.current = true;
      
      return () => subscription.unsubscribe();
    };

    initializeAuth();

    return () => {
      isMounted = false;
    };
  }, []);

  const signIn = async (email: string, password: string) => {
    // Clear any stale cache before signing in
    clearCachedRole();
    setRoleError(null);
    
    const { error, data } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    
    // Initialize OneSignal and link user after successful login
    if (!error && data.user) {
      try {
        await initOneSignal();
        await setExternalUserId(data.user.id);
        // Prompt for push notifications after a short delay
        setTimeout(async () => {
          await promptForPushPermission();
        }, 2000);
      } catch (e) {
        console.error("[Auth] OneSignal setup error:", e);
      }
    }
    
    return { error };
  };

  const signOut = async () => {
    clearCachedRole();
    setRoleError(null);
    
    // Unlink user from OneSignal
    try {
      await removeExternalUserId();
    } catch (e) {
      console.error("[Auth] OneSignal logout error:", e);
    }
    
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    setRole(null);
    setAllowedPanels([]);
    setFeedbackPermissions(defaultFeedbackPermissions);
    setCajaMenorPermissions(defaultCajaMenorPermissions);
  };

  return (
    <AuthContext.Provider value={{ 
      user, 
      session, 
      role, 
      allowedPanels,
      feedbackPermissions,
      cajaMenorPermissions,
      loading, 
      roleLoading,
      roleError,
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
