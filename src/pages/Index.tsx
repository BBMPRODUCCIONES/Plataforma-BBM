import { useEffect, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import bbmLogo from "@/assets/bbm-logo.png";
import { InstallPWAButton } from "@/components/InstallPWAButton";

const Index = () => {
  const { user, loading, roleLoading, signIn } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isResettingPassword, setIsResettingPassword] = useState(false);
  const [showResetForm, setShowResetForm] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [resetSent, setResetSent] = useState(false);
  const [resetCooldown, setResetCooldown] = useState(0);

  // Cooldown timer for resending reset email (avoids accidental spam clicks)
  useEffect(() => {
    if (resetCooldown <= 0) return;
    const t = window.setInterval(() => {
      setResetCooldown((s) => Math.max(0, s - 1));
    }, 1000);
    return () => window.clearInterval(t);
  }, [resetCooldown]);

  // Redirect authenticated users to /usuarios ONLY after BOTH loading states are complete
  if (!loading && !roleLoading && user) {
    return <Navigate to="/usuarios" replace />;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email || !password) {
      toast({
        title: "Error",
        description: "Por favor ingresa tu correo y contraseña",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    
    const { error } = await signIn(email, password);
    
    if (error) {
      toast({
        title: "Error de autenticación",
        description: "Correo o contraseña incorrectos",
        variant: "destructive",
      });
      setIsSubmitting(false);
    } else {
      navigate("/usuarios");
    }
  };

  const handlePasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!resetEmail) {
      toast({
        title: "Error",
        description: "Por favor ingresa tu correo electrónico",
        variant: "destructive",
      });
      return;
    }

    setIsResettingPassword(true);
    
    const { error } = await supabase.auth.resetPasswordForEmail(resetEmail, {
      redirectTo: `${window.location.origin}/auth?type=recovery`,
    });
    
    if (error) {
      toast({
        title: "Error",
        description: "No se pudo enviar el correo de recuperación",
        variant: "destructive",
      });
    } else {
      toast({
        title: "Correo enviado",
        description: "Revisa tu bandeja de entrada para restablecer tu contraseña",
      });
      setResetSent(true);
      setResetCooldown(30);
    }
    
    setIsResettingPassword(false);
  };

  // Show loading while auth OR role is loading
  if (loading || roleLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <span className="text-sm text-muted-foreground">Cargando...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center space-y-4">
          <div className="flex justify-center">
            <img 
              src={bbmLogo} 
              alt="BBM Producciones" 
              className="h-24 w-auto object-contain"
            />
          </div>
          <CardDescription className="text-muted-foreground">
            Plataforma interna de gestión de proyectos
          </CardDescription>
        </CardHeader>
        <CardContent>
          {showResetForm ? (
            <form onSubmit={handlePasswordReset} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="reset-email">Correo electrónico</Label>
                <Input
                  id="reset-email"
                  type="email"
                  placeholder="tu@correo.com"
                  value={resetEmail}
                  onChange={(e) => setResetEmail(e.target.value)}
                  disabled={isResettingPassword}
                />
              </div>
              <Button type="submit" className="w-full" disabled={isResettingPassword || resetCooldown > 0}>
                {isResettingPassword ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Enviando...
                  </>
                ) : (
                  resetSent
                    ? resetCooldown > 0
                      ? `Reenviar en ${resetCooldown}s`
                      : "Reenviar enlace"
                    : "Enviar enlace de recuperación"
                )}
              </Button>
              {resetSent && (
                <p className="text-xs text-muted-foreground text-center">
                  Si no llega en 2–3 minutos, revisa SPAM/No deseado y busca “recovery”.
                </p>
              )}
              <Button 
                type="button" 
                variant="ghost" 
                className="w-full text-muted-foreground"
                onClick={() => {
                  setShowResetForm(false);
                  setResetSent(false);
                  setResetCooldown(0);
                }}
              >
                Volver al inicio de sesión
              </Button>
            </form>
          ) : (
            <>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Correo electrónico</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="tu@correo.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={isSubmitting}
                  />
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="password">Contraseña</Label>
                    <button
                      type="button"
                      className="text-xs text-primary hover:underline"
                      onClick={() => {
                        setShowResetForm(true);
                        setResetSent(false);
                        setResetCooldown(0);
                      }}
                    >
                      ¿Olvidaste tu contraseña?
                    </button>
                  </div>
                  <Input
                    id="password"
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={isSubmitting}
                  />
                </div>
                <Button type="submit" className="w-full" disabled={isSubmitting}>
                  {isSubmitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Iniciando sesión...
                    </>
                  ) : (
                    "Iniciar sesión"
                  )}
                </Button>
              </form>
              
              {/* PWA Install Button - Mobile only */}
              <InstallPWAButton />
              
              <p className="mt-6 text-xs text-center text-muted-foreground">
                ¿Recibiste una invitación por correo? Usa el link enviado para crear tu cuenta.
              </p>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default Index;
