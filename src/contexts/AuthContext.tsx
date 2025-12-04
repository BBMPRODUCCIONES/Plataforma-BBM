import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

type AppRole = Database["public"]["Enums"]["app_role"];

interface UserRoleData {
  role: AppRole;
  allowedPanels: string[];
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  role: AppRole | null;
  allowedPanels: string[];
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  refreshUserRole: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [role, setRole] = useState<AppRole | null>(null);
  const [allowedPanels, setAllowedPanels] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchUserRole = async (userId: string): Promise<UserRoleData | null> => {
    const { data, error } = await supabase
      .from("user_roles")
      .select("role, allowed_panels")
      .eq("user_id", userId)
      .maybeSingle();

    if (error) {
      console.error("Error fetching user role:", error);
      return null;
    }
    
    if (!data) return null;
    
    return {
      role: data.role,
      allowedPanels: data.allowed_panels || []
    };
  };

  const refreshUserRole = async () => {
    if (user) {
      const roleData = await fetchUserRole(user.id);
      if (roleData) {
        setRole(roleData.role);
        setAllowedPanels(roleData.allowedPanels);
      }
    }
  };

  useEffect(() => {
    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        
        // Defer role fetch with setTimeout to avoid deadlock
        if (session?.user) {
          setTimeout(() => {
            fetchUserRole(session.user.id).then((data) => {
              if (data) {
                setRole(data.role);
                setAllowedPanels(data.allowedPanels);
              }
            });
          }, 0);
        } else {
          setRole(null);
          setAllowedPanels([]);
        }
        
        setLoading(false);
      }
    );

    // THEN check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      
      if (session?.user) {
        fetchUserRole(session.user.id).then((data) => {
          if (data) {
            setRole(data.role);
            setAllowedPanels(data.allowedPanels);
          }
        });
      }
      
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    return { error };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    setRole(null);
    setAllowedPanels([]);
  };

  return (
    <AuthContext.Provider value={{ 
      user, 
      session, 
      role, 
      allowedPanels,
      loading, 
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
