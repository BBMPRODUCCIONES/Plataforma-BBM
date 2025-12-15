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
import { UserPlus, Mail, Clock, CheckCircle, AlertCircle, Loader2, Copy, Settings, Save, Trash2 } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
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
  allowed_panels: string[];
  puede_ver_feedback: boolean;
  puede_editar_feedback: boolean;
  created_at: string | null;
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
  const { role: currentUserRole } = useAuth();
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
  const [isSaving, setIsSaving] = useState(false);

  // Delete user state
  const [userToDelete, setUserToDelete] = useState<UserWithRole | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

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
        .select("user_id, role, allowed_panels, email, puede_ver_feedback, puede_editar_feedback");

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
        body: { 
          email: newEmail.trim(), 
          role: newRole,
          allowed_panels: newRole === "administrador" 
            ? ALL_PANELS 
            : newPanels
        },
      });

      if (error) throw error;
      if (data.error) throw new Error(data.error);

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
    // For admin, always show true; for others, use stored values
    if (user.role === "administrador") {
      setEditPuedeVerFeedback(true);
      setEditPuedeEditarFeedback(true);
    } else {
      setEditPuedeVerFeedback(user.puede_ver_feedback);
      setEditPuedeEditarFeedback(user.puede_editar_feedback);
    }
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

      // Update user roles with feedback permissions
      const { error: roleError } = await supabase
        .from("user_roles")
        .update({ 
          role: editRole,
          allowed_panels: finalPanels,
          puede_ver_feedback: finalPuedeVerFeedback,
          puede_editar_feedback: finalPuedeEditarFeedback
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

    setIsDeleting(true);
    try {
      // Delete from user_roles
      const { error: roleError } = await supabase
        .from("user_roles")
        .delete()
        .eq("user_id", userToDelete.id);

      if (roleError) throw roleError;

      // Delete from profiles
      const { error: profileError } = await supabase
        .from("profiles")
        .delete()
        .eq("id", userToDelete.id);

      if (profileError) {
        console.error("Error deleting profile:", profileError);
        // Don't fail if profile doesn't exist
      }

      toast({
        title: "Usuario eliminado",
        description: `Se ha eliminado el usuario ${userToDelete.email}`,
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
      render: (item: UserWithRole) => (
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
            title="Eliminar usuario"
            className="text-destructive hover:text-destructive hover:bg-destructive/10"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ),
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
                <p className="text-sm text-muted-foreground p-3 bg-muted/20 rounded-md">
                  Los administradores tienen acceso completo a todos los paneles y funciones, incluyendo Feedback.
                </p>
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
