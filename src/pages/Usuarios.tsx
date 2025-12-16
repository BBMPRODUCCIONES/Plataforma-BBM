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
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { UserPlus, Mail, Clock, CheckCircle, AlertCircle, Loader2, Copy, Settings, Save, Trash2, History, RefreshCw } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import type { Database } from "@/integrations/supabase/types";

interface ReactivationData {
  email: string;
  role: Database["public"]["Enums"]["app_role"];
  allowed_panels: string[];
  isOrphanedUser?: boolean;
  orphanedUserId?: string;
  deletedEmployee: {
    id: string;
    nombre: string;
    deleted_at: string;
  } | null;
  deletedUser: {
    target_email: string;
    created_at: string;
  } | null;
}

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
  allowed_panels: string[];
  puede_ver_feedback: boolean;
  puede_editar_feedback: boolean;
  puede_aprobar_caja_menor: boolean;
  created_at: string | null;
}

interface AuditLogEntry {
  id: string;
  action: string;
  actor_email: string;
  target_email: string | null;
  target_role: string | null;
  panel: string | null;
  created_at: string;
}

const roleLabels: Record<AppRole, string> = {
  administrador: "Administrador",
  operativo: "Operativo",
  visual: "Visual",
};

const ALL_PANELS = ["directivo", "general", "operaciones", "proveedores"];

const panelLabels: Record<string, string> = {
  directivo: "Panel Directivo",
  general: "Panel General",
  operaciones: "Panel Operaciones",
  proveedores: "Proveedores",
};

const Usuarios = () => {
  const { role: currentUserRole, user: currentUser } = useAuth();
  const { toast } = useToast();
  
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [users, setUsers] = useState<UserWithRole[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const [newEmail, setNewEmail] = useState("");
  const [newRole, setNewRole] = useState<AppRole>("operativo");
  const [newPanels, setNewPanels] = useState<string[]>(["general", "operaciones"]);
  const [generatedLink, setGeneratedLink] = useState("");

  // Edit user state
  const [editingUser, setEditingUser] = useState<UserWithRole | null>(null);
  const [editRole, setEditRole] = useState<AppRole>("operativo");
  const [editPanels, setEditPanels] = useState<string[]>([]);
  const [editName, setEditName] = useState("");
  const [editPuedeVerFeedback, setEditPuedeVerFeedback] = useState(false);
  const [editPuedeEditarFeedback, setEditPuedeEditarFeedback] = useState(false);
  const [editPuedeAprobarCajaMenor, setEditPuedeAprobarCajaMenor] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Delete user state
  const [userToDelete, setUserToDelete] = useState<UserWithRole | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Audit log state
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
  const [showAuditLog, setShowAuditLog] = useState(false);

  // Reactivation state
  const [showReactivateModal, setShowReactivateModal] = useState(false);
  const [reactivationData, setReactivationData] = useState<ReactivationData | null>(null);
  const [isReactivating, setIsReactivating] = useState(false);
  const [isDeletingOrphan, setIsDeletingOrphan] = useState(false);

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

      // Fetch users with roles and panels (now includes email and feedback permissions)
      const { data: rolesData, error: rolesError } = await supabase
        .from("user_roles")
        .select("user_id, role, allowed_panels, email, puede_ver_feedback, puede_editar_feedback, puede_aprobar_caja_menor");

      if (rolesError) throw rolesError;

      // Fetch profiles
      const { data: profilesData, error: profilesError } = await supabase
        .from("profiles")
        .select("id, full_name, created_at");

      if (profilesError) throw profilesError;

      // Combine data - now using email directly from user_roles
      const usersWithRoles: UserWithRole[] = (rolesData || []).map((roleRecord) => {
        const profile = profilesData?.find((p) => p.id === roleRecord.user_id);
        
        return {
          id: roleRecord.user_id,
          email: roleRecord.email || "Usuario sin email",
          full_name: profile?.full_name || null,
          role: roleRecord.role,
          allowed_panels: roleRecord.allowed_panels || [],
          puede_ver_feedback: roleRecord.puede_ver_feedback ?? false,
          puede_editar_feedback: roleRecord.puede_editar_feedback ?? false,
          puede_aprobar_caja_menor: roleRecord.puede_aprobar_caja_menor ?? false,
          created_at: profile?.created_at || null,
        };
      });

      setUsers(usersWithRoles);

      // Fetch audit logs
      const { data: auditData, error: auditError } = await supabase
        .from("user_audit_log")
        .select("id, action, actor_email, target_email, target_role, panel, created_at")
        .order("created_at", { ascending: false })
        .limit(50);

      if (auditError) {
        console.error("Error fetching audit logs:", auditError);
      } else {
        setAuditLogs(auditData || []);
      }
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
        body: { 
          email: newEmail.trim(), 
          role: newRole,
          allowed_panels: newRole === "administrador" 
            ? ALL_PANELS 
            : newPanels
        },
      });

      // Handle edge function errors - check data.error first as it contains the actual message
      if (data?.error) {
        throw new Error(data.error);
      }
      
      if (error) {
        // Try to extract error message from the response
        const errorMsg = error.message || "No se pudo crear la invitación";
        throw new Error(errorMsg);
      }

      // Check if needs reactivation (deleted user, orphaned user, or soft-deleted employee)
      if (data.needsReactivation) {
        setReactivationData({
          email: newEmail.trim(),
          role: newRole,
          allowed_panels: newRole === "administrador" ? ALL_PANELS : newPanels,
          isOrphanedUser: data.isOrphanedUser || false,
          orphanedUserId: data.orphanedUserId,
          deletedEmployee: data.deletedEmployee,
          deletedUser: data.deletedUser
        });
        setShowReactivateModal(true);
        setIsDialogOpen(false);
        setIsSubmitting(false);
        return;
      }

      const invitationLink = `${window.location.origin}/crear-cuenta?token=${data.invitation.token}`;
      setGeneratedLink(invitationLink);

      // Show different message based on employee status
      if (data.employeeLinked) {
        toast({
          title: "Invitación creada (empleado existente vinculado)",
          description: `Se usará el registro de empleado existente para ${newEmail}`,
        });
      } else if (data.employeeCreated) {
        toast({
          title: "Invitación y empleado creados",
          description: `Se creó invitación y empleado automáticamente para ${newEmail}`,
        });
      } else {
        toast({
          title: "Invitación creada",
          description: `Se ha creado una invitación para ${newEmail}`,
        });
      }

      fetchData();
    } catch (error: any) {
      console.error("Error creating invitation:", error);
      
      // Handle specific error messages for better UX
      let errorMessage = error.message || "No se pudo crear la invitación";
      let errorTitle = "Error";
      
      if (errorMessage.includes("ya está registrado como usuario activo")) {
        errorTitle = "Correo duplicado";
      } else if (errorMessage.includes("invitación pendiente")) {
        errorTitle = "Invitación existente";
      }
      
      toast({
        title: errorTitle,
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReactivateUser = async () => {
    if (!reactivationData) return;

    setIsReactivating(true);

    try {
      const { data, error } = await supabase.functions.invoke("reactivate-user", {
        body: {
          email: reactivationData.email,
          role: reactivationData.role,
          allowed_panels: reactivationData.allowed_panels,
          orphanedUserId: reactivationData.orphanedUserId,
          action: 'reactivate'
        },
      });

      if (error) throw error;
      if (data.error) throw new Error(data.error);

      const invitationLink = `${window.location.origin}/crear-cuenta?token=${data.invitation.token}`;
      setGeneratedLink(invitationLink);

      toast({
        title: data.employeeReactivated ? "Usuario y empleado reactivados" : "Usuario reactivado",
        description: data.message || `Se ha generado un nuevo link de invitación para ${reactivationData.email}`,
      });

      setShowReactivateModal(false);
      setReactivationData(null);
      setIsDialogOpen(true); // Show the dialog with the generated link

      fetchData();
    } catch (error: any) {
      console.error("Error reactivating user:", error);
      toast({
        title: "Error",
        description: error.message || "No se pudo reactivar el usuario",
        variant: "destructive",
      });
    } finally {
      setIsReactivating(false);
    }
  };

  const handleDeleteOrphanCompletely = async () => {
    if (!reactivationData || !reactivationData.orphanedUserId) return;

    setIsDeletingOrphan(true);

    try {
      const { data, error } = await supabase.functions.invoke("reactivate-user", {
        body: {
          email: reactivationData.email,
          role: reactivationData.role,
          allowed_panels: reactivationData.allowed_panels,
          orphanedUserId: reactivationData.orphanedUserId,
          action: 'delete_completely'
        },
      });

      if (error) throw error;
      if (data.error) throw new Error(data.error);

      toast({
        title: "Usuario eliminado",
        description: `Se eliminó completamente el usuario huérfano ${reactivationData.email}`,
      });

      setShowReactivateModal(false);
      setReactivationData(null);
      setNewEmail("");
      setNewRole("operativo");
      setNewPanels(["general", "operaciones"]);

      fetchData();
    } catch (error: any) {
      console.error("Error deleting orphan user:", error);
      toast({
        title: "Error",
        description: error.message || "No se pudo eliminar el usuario huérfano",
        variant: "destructive",
      });
    } finally {
      setIsDeletingOrphan(false);
    }
  };

  const handleCloseReactivateModal = () => {
    setShowReactivateModal(false);
    setReactivationData(null);
    setNewEmail("");
    setNewRole("operativo");
    setNewPanels(["general", "operaciones"]);
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
    setNewPanels(["general", "operaciones"]);
    setGeneratedLink("");
  };

  const handleEditUser = (user: UserWithRole) => {
    setEditingUser(user);
    setEditRole(user.role);
    setEditPanels(user.allowed_panels);
    setEditName(user.full_name || "");
    // For admin, always show true for feedback; for others, use stored values
    if (user.role === "administrador") {
      setEditPuedeVerFeedback(true);
      setEditPuedeEditarFeedback(true);
    } else {
      setEditPuedeVerFeedback(user.puede_ver_feedback);
      setEditPuedeEditarFeedback(user.puede_editar_feedback);
    }
    // Caja Menor permission - only for admins, stored value
    setEditPuedeAprobarCajaMenor(user.puede_aprobar_caja_menor);
  };

  const handleSaveUser = async () => {
    if (!editingUser) return;

    setIsSaving(true);
    try {
      // Determine panels based on role
      const finalPanels = editRole === "administrador" 
        ? ALL_PANELS 
        : editPanels;

      // Determine feedback permissions based on role
      const finalPuedeVerFeedback = editRole === "administrador" ? true : editPuedeVerFeedback;
      const finalPuedeEditarFeedback = editRole === "administrador" ? true : editPuedeEditarFeedback;
      
      // Caja Menor permission - only admins can have this
      const finalPuedeAprobarCajaMenor = editRole === "administrador" ? editPuedeAprobarCajaMenor : false;

      // Update user roles with all permissions
      const { error: roleError } = await supabase
        .from("user_roles")
        .update({ 
          role: editRole,
          allowed_panels: finalPanels,
          puede_ver_feedback: finalPuedeVerFeedback,
          puede_editar_feedback: finalPuedeEditarFeedback,
          puede_aprobar_caja_menor: finalPuedeAprobarCajaMenor
        })
        .eq("user_id", editingUser.id);

      if (roleError) throw roleError;

      // Update profile name if changed
      if (editName !== editingUser.full_name) {
        const { error: profileError } = await supabase
          .from("profiles")
          .update({ full_name: editName || null })
          .eq("id", editingUser.id);

        if (profileError) throw profileError;
      }

      toast({
        title: "Usuario actualizado",
        description: "Los datos del usuario han sido actualizados",
      });

      setEditingUser(null);
      fetchData();
    } catch (error: any) {
      console.error("Error updating user:", error);
      toast({
        title: "Error",
        description: error.message || "No se pudo actualizar el usuario",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteUser = async () => {
    if (!userToDelete) return;

    if (currentUser?.id && userToDelete.id === currentUser.id) {
      toast({
        title: "Acción no permitida",
        description: "No puedes eliminar tu propio usuario.",
        variant: "destructive",
      });
      return;
    }

    setIsDeleting(true);
    try {
      const { data, error } = await supabase.functions.invoke("delete-user", {
        body: { user_id: userToDelete.id },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast({
        title: "Usuario eliminado",
        description: `Se eliminó el usuario ${userToDelete.email}`,
      });

      setUserToDelete(null);
      fetchData();
    } catch (error: any) {
      console.error("Error deleting user:", error);
      toast({
        title: "Error",
        description: error.message || "No se pudo eliminar el usuario",
        variant: "destructive",
      });
    } finally {
      setIsDeleting(false);
    }
  };

  const handlePanelToggle = (panel: string, checked: boolean, isNew: boolean = false) => {
    if (isNew) {
      setNewPanels(prev => 
        checked ? [...prev, panel] : prev.filter(p => p !== panel)
      );
    } else {
      setEditPanels(prev => 
        checked ? [...prev, panel] : prev.filter(p => p !== panel)
      );
    }
  };

  const pendingInvitations = invitations.filter((i) => !i.accepted_at);

  const invitationColumns = [
    {
      key: "email",
      header: "Email",
      width: "250px",
      render: (item: Invitation) => item.email,
    },
    {
      key: "role",
      header: "Rol",
      width: "120px",
      render: (item: Invitation) => (
        <Badge variant="outline">{roleLabels[item.role]}</Badge>
      ),
    },
    {
      key: "status",
      header: "Estado",
      width: "120px",
      render: (item: Invitation) => {
        const isExpired = new Date(item.expires_at) < new Date();
        if (item.accepted_at) {
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
      key: "created_at",
      header: "Creada",
      width: "150px",
      render: (item: Invitation) =>
        item.created_at ? new Date(item.created_at).toLocaleDateString("es-ES") : "-",
    },
    {
      key: "expires_at",
      header: "Expira",
      width: "150px",
      render: (item: Invitation) => new Date(item.expires_at).toLocaleDateString("es-ES"),
    },
  ];

  const userColumns = [
    {
      key: "email",
      header: "Email",
      width: "minmax(280px, 1fr)",
      render: (item: UserWithRole) => (
        <span className="truncate block" title={item.email}>
          {item.email}
        </span>
      ),
    },
    {
      key: "full_name",
      header: "Nombre",
      width: "minmax(180px, 1fr)",
      render: (item: UserWithRole) => (
        <span className="truncate block" title={item.full_name || "-"}>
          {item.full_name || "-"}
        </span>
      ),
    },
    {
      key: "role",
      header: "Rol",
      width: "130px",
      render: (item: UserWithRole) => (
        <Badge variant="outline">{roleLabels[item.role]}</Badge>
      ),
    },
    {
      key: "panels",
      header: "Paneles",
      width: "minmax(280px, 1fr)",
      render: (item: UserWithRole) => (
        <div className="flex flex-wrap gap-1">
          {item.allowed_panels.map((panel) => (
            <Badge key={panel} variant="secondary" className="text-xs">
              {panelLabels[panel] || panel}
            </Badge>
          ))}
        </div>
      ),
    },
    {
      key: "created_at",
      header: "Registrado",
      width: "120px",
      render: (item: UserWithRole) =>
        item.created_at ? new Date(item.created_at).toLocaleDateString("es-ES") : "-",
    },
    {
      key: "actions",
      header: "Acciones",
      width: "120px",
      render: (item: UserWithRole) => {
        const isSelf = !!currentUser?.id && item.id === currentUser.id;
        return (
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleEditUser(item)}
              title="Editar usuario"
            >
              <Settings className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setUserToDelete(item)}
              title={isSelf ? "No puedes eliminar tu propio usuario" : "Eliminar usuario"}
              disabled={isSelf}
              className="text-destructive hover:text-destructive hover:bg-destructive/10"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        );
      },
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
          description="Administra usuarios, roles y permisos del sistema"
        />

        <div className="flex justify-end">
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <UserPlus className="mr-2 h-4 w-4" />
                Nueva Invitación
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
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
                      onValueChange={(value) => {
                        setNewRole(value as AppRole);
                        // Auto-select all panels for admin
                        if (value === "administrador") {
                          setNewPanels(ALL_PANELS);
                        }
                      }}
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
                  
                  {/* Panel access selection - only for non-admin roles */}
                  {newRole !== "administrador" && (
                    <div className="space-y-2">
                      <Label>Acceso a Paneles</Label>
                      <div className="space-y-2 p-3 border rounded-md bg-muted/20">
                        {ALL_PANELS.filter(p => p !== "directivo").map((panel) => (
                          <div key={panel} className="flex items-center space-x-2">
                            <Checkbox
                              id={`new-panel-${panel}`}
                              checked={newPanels.includes(panel)}
                              onCheckedChange={(checked) => 
                                handlePanelToggle(panel, checked as boolean, true)
                              }
                              disabled={isSubmitting}
                            />
                            <Label 
                              htmlFor={`new-panel-${panel}`}
                              className="text-sm font-normal cursor-pointer"
                            >
                              {panelLabels[panel]}
                            </Label>
                          </div>
                        ))}
                        <p className="text-xs text-muted-foreground mt-2">
                          Nota: Panel Directivo solo está disponible para Administradores.
                        </p>
                      </div>
                    </div>
                  )}
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

        {/* Edit User Dialog */}
        <Dialog open={!!editingUser} onOpenChange={(open) => !open && setEditingUser(null)}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Editar Usuario</DialogTitle>
              <DialogDescription>
                Modifica el rol y los permisos de acceso para {editingUser?.email}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Email</Label>
                <Input value={editingUser?.email || ""} disabled className="bg-muted/50" />
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-name">Nombre Completo</Label>
                <Input 
                  id="edit-name"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  placeholder="Nombre del usuario"
                  disabled={isSaving}
                />
              </div>
              
              <div className="space-y-2">
                <Label>Rol</Label>
                <Select
                  value={editRole}
                  onValueChange={(value) => {
                    setEditRole(value as AppRole);
                    if (value === "administrador") {
                      setEditPanels(ALL_PANELS);
                    }
                  }}
                  disabled={isSaving}
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

              {/* Panel access - only editable for non-admin */}
              {editRole !== "administrador" && (
                <div className="space-y-2">
                  <Label>Acceso a Paneles</Label>
                  <div className="space-y-2 p-3 border rounded-md bg-muted/20">
                    {ALL_PANELS.filter(p => p !== "directivo").map((panel) => (
                      <div key={panel} className="flex items-center space-x-2">
                        <Checkbox
                          id={`edit-panel-${panel}`}
                          checked={editPanels.includes(panel)}
                          onCheckedChange={(checked) => 
                            handlePanelToggle(panel, checked as boolean, false)
                          }
                          disabled={isSaving}
                        />
                        <Label 
                          htmlFor={`edit-panel-${panel}`}
                          className="text-sm font-normal cursor-pointer"
                        >
                          {panelLabels[panel]}
                        </Label>
                      </div>
                    ))}
                    <p className="text-xs text-muted-foreground mt-2">
                      Panel Directivo solo está disponible para Administradores.
                    </p>
                  </div>
                </div>
              )}

              {editRole === "administrador" && (
                <div className="space-y-4">
                  <p className="text-sm text-muted-foreground p-3 bg-muted/20 rounded-md">
                    Los administradores tienen acceso completo a todos los paneles y funciones, incluyendo Feedback.
                  </p>
                  
                  {/* Caja Menor Approval Permission - only for admins */}
                  <div className="space-y-2">
                    <Label>Permisos Especiales de Caja Menor</Label>
                    <div className="space-y-2 p-3 border rounded-md bg-amber-500/10 border-amber-500/30">
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id="edit-puede-aprobar-caja-menor"
                          checked={editPuedeAprobarCajaMenor}
                          onCheckedChange={(checked) => setEditPuedeAprobarCajaMenor(checked as boolean)}
                          disabled={isSaving}
                        />
                        <Label 
                          htmlFor="edit-puede-aprobar-caja-menor"
                          className="text-sm font-normal cursor-pointer"
                        >
                          Puede aprobar/desaprobar registros de Caja Menor
                        </Label>
                      </div>
                      <p className="text-xs text-muted-foreground mt-2">
                        Solo los usuarios con este permiso pueden cambiar el estado (Aprobado/No aprobado) de los registros de Caja Menor.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Feedback Permissions - only for non-admin roles */}
              {editRole !== "administrador" && (
                <div className="space-y-2">
                  <Label>Permisos de Feedback</Label>
                  <div className="space-y-2 p-3 border rounded-md bg-muted/20">
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="edit-puede-ver-feedback"
                        checked={editPuedeVerFeedback}
                        onCheckedChange={(checked) => {
                          setEditPuedeVerFeedback(checked as boolean);
                          // If removing view permission, also remove edit permission
                          if (!checked) {
                            setEditPuedeEditarFeedback(false);
                          }
                        }}
                        disabled={isSaving}
                      />
                      <Label 
                        htmlFor="edit-puede-ver-feedback"
                        className="text-sm font-normal cursor-pointer"
                      >
                        Puede ver Feedback
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="edit-puede-editar-feedback"
                        checked={editPuedeEditarFeedback}
                        onCheckedChange={(checked) => {
                          setEditPuedeEditarFeedback(checked as boolean);
                          // If enabling edit permission, also enable view permission
                          if (checked) {
                            setEditPuedeVerFeedback(true);
                          }
                        }}
                        disabled={isSaving || !editPuedeVerFeedback}
                      />
                      <Label 
                        htmlFor="edit-puede-editar-feedback"
                        className="text-sm font-normal cursor-pointer"
                      >
                        Puede editar Feedback
                      </Label>
                    </div>
                    <p className="text-xs text-muted-foreground mt-2">
                      Activa estos permisos para dar acceso a la sección Feedback en proyectos.
                    </p>
                  </div>
                </div>
              )}
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setEditingUser(null)} disabled={isSaving}>
                Cancelar
              </Button>
              <Button onClick={handleSaveUser} disabled={isSaving}>
                {isSaving ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Guardando...
                  </>
                ) : (
                  <>
                    <Save className="mr-2 h-4 w-4" />
                    Guardar
                  </>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete User Confirmation Dialog */}
        <AlertDialog open={!!userToDelete} onOpenChange={(open) => !open && setUserToDelete(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>¿Eliminar usuario?</AlertDialogTitle>
              <AlertDialogDescription>
                Esta acción eliminará permanentemente al usuario <strong>{userToDelete?.email}</strong> y todos sus permisos asociados. Esta acción no se puede deshacer.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={isDeleting}>Cancelar</AlertDialogCancel>
              <AlertDialogAction 
                onClick={handleDeleteUser}
                disabled={isDeleting}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {isDeleting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Eliminando...
                  </>
                ) : (
                  "Eliminar"
                )}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Reactivate User Modal */}
        <Dialog open={showReactivateModal} onOpenChange={(open) => !open && handleCloseReactivateModal()}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <RefreshCw className="h-5 w-5 text-amber-500" />
                {reactivationData?.isOrphanedUser ? "Usuario con Datos Incompletos" : "Usuario Previamente Eliminado"}
              </DialogTitle>
              <DialogDescription>
                {reactivationData?.isOrphanedUser ? (
                  <>El correo <strong>{reactivationData?.email}</strong> existe en el sistema pero sin rol asignado (datos incompletos).</>
                ) : (
                  <>El correo <strong>{reactivationData?.email}</strong> ya estaba registrado pero fue eliminado. ¿Deseas reactivar este usuario?</>
                )}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              {reactivationData?.isOrphanedUser && (
                <div className="p-3 rounded-lg bg-orange-500/10 border border-orange-500/30">
                  <p className="text-sm font-medium text-orange-600 dark:text-orange-400">
                    Usuario huérfano detectado
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Este usuario existe en el sistema de autenticación pero no tiene rol ni permisos asignados. 
                    Puedes reactivarlo (se eliminará el registro incompleto y se creará una nueva invitación) 
                    o eliminarlo completamente del sistema.
                  </p>
                </div>
              )}

              {reactivationData?.deletedEmployee && (
                <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/30">
                  <p className="text-sm font-medium text-amber-600 dark:text-amber-400">
                    Empleado encontrado:
                  </p>
                  <p className="text-sm mt-1">
                    <strong>{reactivationData.deletedEmployee.nombre}</strong>
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Eliminado: {new Date(reactivationData.deletedEmployee.deleted_at).toLocaleDateString("es-ES")}
                  </p>
                </div>
              )}

              {reactivationData?.deletedUser && !reactivationData?.deletedEmployee && !reactivationData?.isOrphanedUser && (
                <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/30">
                  <p className="text-sm font-medium text-amber-600 dark:text-amber-400">
                    Usuario previamente eliminado
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Fecha: {new Date(reactivationData.deletedUser.created_at).toLocaleDateString("es-ES")}
                  </p>
                </div>
              )}

              <div className="p-3 rounded-lg bg-muted/50">
                <p className="text-sm">
                  <strong>Rol asignado:</strong> {roleLabels[reactivationData?.role || "operativo"]}
                </p>
                <p className="text-sm mt-1">
                  <strong>Paneles:</strong> {reactivationData?.allowed_panels.map(p => panelLabels[p] || p).join(", ")}
                </p>
              </div>

              <p className="text-xs text-muted-foreground">
                {reactivationData?.isOrphanedUser 
                  ? "Al reactivar se limpiará el registro incompleto y se generará un nuevo link de invitación. Al eliminar completamente se borrará toda la información del usuario."
                  : "Al reactivar, se restaurará el empleado (si existe) y se generará un nuevo link de invitación. El usuario deberá crear una nueva contraseña."
                }
              </p>
            </div>

            <DialogFooter className={reactivationData?.isOrphanedUser ? "flex-col sm:flex-row gap-2" : ""}>
              <Button variant="outline" onClick={handleCloseReactivateModal} disabled={isReactivating || isDeletingOrphan}>
                Cancelar
              </Button>
              
              {reactivationData?.isOrphanedUser && (
                <Button 
                  variant="destructive" 
                  onClick={handleDeleteOrphanCompletely} 
                  disabled={isReactivating || isDeletingOrphan}
                >
                  {isDeletingOrphan ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Eliminando...
                    </>
                  ) : (
                    <>
                      <Trash2 className="mr-2 h-4 w-4" />
                      Eliminar completamente
                    </>
                  )}
                </Button>
              )}
              
              <Button onClick={handleReactivateUser} disabled={isReactivating || isDeletingOrphan} className="bg-amber-600 hover:bg-amber-700">
                {isReactivating ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Reactivando...
                  </>
                ) : (
                  <>
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Reactivar usuario
                  </>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

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

            {/* Audit Log */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                  <History className="h-5 w-5" />
                  Registro de Auditoría
                </h3>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowAuditLog(!showAuditLog)}
                >
                  {showAuditLog ? "Ocultar" : "Mostrar"}
                </Button>
              </div>
              {showAuditLog && (
                <div className="border rounded-lg overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-muted/50">
                        <tr>
                          <th className="px-4 py-2 text-left font-medium">Fecha</th>
                          <th className="px-4 py-2 text-left font-medium">Acción</th>
                          <th className="px-4 py-2 text-left font-medium">Ejecutado por</th>
                          <th className="px-4 py-2 text-left font-medium">Usuario afectado</th>
                          <th className="px-4 py-2 text-left font-medium">Rol</th>
                          <th className="px-4 py-2 text-left font-medium">Panel</th>
                        </tr>
                      </thead>
                      <tbody>
                        {auditLogs.length === 0 ? (
                          <tr>
                            <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                              No hay registros de auditoría
                            </td>
                          </tr>
                        ) : (
                          auditLogs.map((log) => (
                            <tr key={log.id} className="border-t border-border/50 hover:bg-muted/30">
                              <td className="px-4 py-2 whitespace-nowrap">
                                {new Date(log.created_at).toLocaleString("es-ES", {
                                  day: "2-digit",
                                  month: "2-digit",
                                  year: "numeric",
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })}
                              </td>
                              <td className="px-4 py-2">
                                <Badge variant={
                                  log.action === "DELETE_USER" || log.action === "DELETE_ORPHANED_USER" 
                                    ? "destructive" 
                                    : log.action === "INCOMPLETE_DELETION_DETECTED"
                                    ? "outline"
                                    : log.action.includes("REACTIVATE")
                                    ? "default"
                                    : "secondary"
                                }>
                                  {log.action === "DELETE_USER" ? "Eliminación" 
                                    : log.action === "DELETE_ORPHANED_USER" ? "Eliminación (huérfano)"
                                    : log.action === "INCOMPLETE_DELETION_DETECTED" ? "Eliminación incompleta"
                                    : log.action === "CLEANUP_ORPHANED_USER" ? "Limpieza huérfano"
                                    : log.action === "REACTIVATE_USER" ? "Reactivación"
                                    : log.action === "REACTIVATE_EMPLOYEE" ? "Reactivación empleado"
                                    : log.action}
                                </Badge>
                              </td>
                              <td className="px-4 py-2">{log.actor_email}</td>
                              <td className="px-4 py-2">{log.target_email || "-"}</td>
                              <td className="px-4 py-2">
                                {log.target_role ? (
                                  <Badge variant="outline">
                                    {roleLabels[log.target_role as AppRole] || log.target_role}
                                  </Badge>
                                ) : "-"}
                              </td>
                              <td className="px-4 py-2">{log.panel || "-"}</td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
};

export default Usuarios;
