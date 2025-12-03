import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import Layout from "@/components/Layout";
import { PanelHeader } from "@/components/PanelHeader";
import { MatrixTable } from "@/components/MatrixTable";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { UserPlus, Mail, Clock, CheckCircle, AlertCircle, Loader2, Copy } from "lucide-react";
import type { Database } from "@/integrations/supabase/types";

type AppRole = Database["public"]["Enums"]["app_role"];

interface Invitation {
  id: string;
  email: string;
  role: AppRole;
  created_at: string | null;
  expires_at: string;
  accepted_at: string | null;
  token: string;
}

interface UserWithRole {
  id: string;
  email: string;
  full_name: string | null;
  role: AppRole;
  created_at: string | null;
}

const roleLabels: Record<AppRole, string> = {
  administrador: "Administrador",
  operativo: "Operativo",
  visual: "Visual",
};

const Usuarios = () => {
  const { role: currentUserRole } = useAuth();
  const { toast } = useToast();
  
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [users, setUsers] = useState<UserWithRole[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const [newEmail, setNewEmail] = useState("");
  const [newRole, setNewRole] = useState<AppRole>("operativo");
  const [generatedLink, setGeneratedLink] = useState("");

  const fetchData = async () => {
    setIsLoading(true);
    
    try {
      // Fetch invitations
      const { data: invitationsData, error: invitationsError } = await supabase
        .from("invitations")
        .select("*")
        .order("created_at", { ascending: false });

      if (invitationsError) throw invitationsError;
      setInvitations(invitationsData || []);

      // Fetch users with roles
      const { data: rolesData, error: rolesError } = await supabase
        .from("user_roles")
        .select("user_id, role");

      if (rolesError) throw rolesError;

      // Fetch profiles
      const { data: profilesData, error: profilesError } = await supabase
        .from("profiles")
        .select("id, full_name, created_at");

      if (profilesError) throw profilesError;

      // Combine data
      const usersWithRoles: UserWithRole[] = (rolesData || []).map((roleRecord) => {
        const profile = profilesData?.find((p) => p.id === roleRecord.user_id);
        const invitation = invitationsData?.find((i) => i.accepted_at && i.role === roleRecord.role);
        
        return {
          id: roleRecord.user_id,
          email: invitation?.email || "Usuario",
          full_name: profile?.full_name || null,
          role: roleRecord.role,
          created_at: profile?.created_at || null,
        };
      });

      setUsers(usersWithRoles);
    } catch (error: any) {
      console.error("Error fetching data:", error);
      toast({
        title: "Error",
        description: "No se pudieron cargar los datos",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleCreateInvitation = async () => {
    if (!newEmail.trim()) {
      toast({
        title: "Error",
        description: "Por favor ingresa un email",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    setGeneratedLink("");

    try {
      const { data, error } = await supabase.functions.invoke("create-invitation", {
        body: { email: newEmail.trim(), role: newRole },
      });

      if (error) throw error;
      if (data.error) throw new Error(data.error);

      const invitationLink = `${window.location.origin}/crear-cuenta?token=${data.invitation.token}`;
      setGeneratedLink(invitationLink);

      toast({
        title: "Invitación creada",
        description: `Se ha creado una invitación para ${newEmail}`,
      });

      fetchData();
    } catch (error: any) {
      console.error("Error creating invitation:", error);
      toast({
        title: "Error",
        description: error.message || "No se pudo crear la invitación",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(generatedLink);
    toast({
      title: "Copiado",
      description: "Link de invitación copiado al portapapeles",
    });
  };

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setNewEmail("");
    setNewRole("operativo");
    setGeneratedLink("");
  };

  const pendingInvitations = invitations.filter((i) => !i.accepted_at);

  const invitationColumns = [
    {
      id: "email",
      header: "Email",
      accessorKey: "email",
      width: 250,
    },
    {
      id: "role",
      header: "Rol",
      accessorKey: "role",
      width: 120,
      cell: (value: AppRole) => (
        <Badge variant="outline">{roleLabels[value]}</Badge>
      ),
    },
    {
      id: "status",
      header: "Estado",
      accessorKey: "accepted_at",
      width: 120,
      cell: (value: string | null, row: Invitation) => {
        const isExpired = new Date(row.expires_at) < new Date();
        if (value) {
          return (
            <Badge className="bg-green-500/20 text-green-500">
              <CheckCircle className="h-3 w-3 mr-1" />
              Aceptada
            </Badge>
          );
        }
        if (isExpired) {
          return (
            <Badge variant="destructive">
              <AlertCircle className="h-3 w-3 mr-1" />
              Expirada
            </Badge>
          );
        }
        return (
          <Badge variant="secondary">
            <Clock className="h-3 w-3 mr-1" />
            Pendiente
          </Badge>
        );
      },
    },
    {
      id: "created_at",
      header: "Creada",
      accessorKey: "created_at",
      width: 150,
      cell: (value: string | null) =>
        value ? new Date(value).toLocaleDateString("es-ES") : "-",
    },
    {
      id: "expires_at",
      header: "Expira",
      accessorKey: "expires_at",
      width: 150,
      cell: (value: string) => new Date(value).toLocaleDateString("es-ES"),
    },
  ];

  const userColumns = [
    {
      id: "email",
      header: "Email",
      accessorKey: "email",
      width: 250,
    },
    {
      id: "full_name",
      header: "Nombre",
      accessorKey: "full_name",
      width: 200,
      cell: (value: string | null) => value || "-",
    },
    {
      id: "role",
      header: "Rol",
      accessorKey: "role",
      width: 120,
      cell: (value: AppRole) => (
        <Badge variant="outline">{roleLabels[value]}</Badge>
      ),
    },
    {
      id: "created_at",
      header: "Registrado",
      accessorKey: "created_at",
      width: 150,
      cell: (value: string | null) =>
        value ? new Date(value).toLocaleDateString("es-ES") : "-",
    },
  ];

  if (currentUserRole !== "administrador") {
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

  return (
    <Layout>
      <div className="space-y-6">
        <PanelHeader
          title="Gestión de Usuarios"
          description="Administra usuarios e invitaciones del sistema"
        />

        <div className="flex justify-end">
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <UserPlus className="mr-2 h-4 w-4" />
                Nueva Invitación
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Enviar Invitación</DialogTitle>
                <DialogDescription>
                  Crea una invitación para un nuevo usuario. Recibirá un link para crear su cuenta.
                </DialogDescription>
              </DialogHeader>

              {!generatedLink ? (
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      placeholder="usuario@email.com"
                      value={newEmail}
                      onChange={(e) => setNewEmail(e.target.value)}
                      disabled={isSubmitting}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="role">Rol</Label>
                    <Select
                      value={newRole}
                      onValueChange={(value) => setNewRole(value as AppRole)}
                      disabled={isSubmitting}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="administrador">Administrador</SelectItem>
                        <SelectItem value="operativo">Operativo</SelectItem>
                        <SelectItem value="visual">Visual</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              ) : (
                <div className="space-y-4 py-4">
                  <div className="p-4 bg-muted rounded-lg space-y-2">
                    <p className="text-sm font-medium">Link de invitación:</p>
                    <div className="flex items-center gap-2">
                      <Input value={generatedLink} readOnly className="text-xs" />
                      <Button size="icon" variant="outline" onClick={handleCopyLink}>
                        <Copy className="h-4 w-4" />
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Este link expira en 72 horas. Compártelo con el usuario invitado.
                    </p>
                  </div>
                </div>
              )}

              <DialogFooter>
                {!generatedLink ? (
                  <>
                    <Button variant="outline" onClick={handleCloseDialog}>
                      Cancelar
                    </Button>
                    <Button onClick={handleCreateInvitation} disabled={isSubmitting}>
                      {isSubmitting ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Creando...
                        </>
                      ) : (
                        <>
                          <Mail className="mr-2 h-4 w-4" />
                          Crear Invitación
                        </>
                      )}
                    </Button>
                  </>
                ) : (
                  <Button onClick={handleCloseDialog}>Cerrar</Button>
                )}
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center h-40">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          <div className="space-y-8">
            {/* Pending Invitations */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <Clock className="h-5 w-5" />
                Invitaciones Pendientes ({pendingInvitations.length})
              </h3>
              {pendingInvitations.length > 0 ? (
                <MatrixTable
                  columns={invitationColumns}
                  data={pendingInvitations}
                />
              ) : (
                <p className="text-muted-foreground text-sm">
                  No hay invitaciones pendientes
                </p>
              )}
            </div>

            {/* Registered Users */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <CheckCircle className="h-5 w-5" />
                Usuarios Registrados ({users.length})
              </h3>
              {users.length > 0 ? (
                <MatrixTable columns={userColumns} data={users} />
              ) : (
                <p className="text-muted-foreground text-sm">
                  No hay usuarios registrados
                </p>
              )}
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
};

export default Usuarios;
