import { useState } from "react";
import Layout from "@/components/Layout";
import { PanelHeader } from "@/components/PanelHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { mockUsers } from "@/data/mockData";
import { User, UserRole } from "@/types";
import { MatrixTable } from "@/components/MatrixTable";
import { Plus, Eye, Trash2, Edit } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const PANELS = [
  { id: "directivo", label: "Panel Directivo" },
  { id: "general", label: "Panel General" },
  { id: "operaciones", label: "Panel Operaciones" },
  { id: "proveedores", label: "Proveedores" },
  { id: "constructor", label: "Constructor de Campos" },
  { id: "agentes-ia", label: "Agentes IA" },
  { id: "google-calendar", label: "Google Calendar" },
];

const ROLES: { value: UserRole; label: string }[] = [
  { value: "administrador", label: "Administrador" },
  { value: "operativo", label: "Operativo" },
  { value: "visual", label: "Visual (Solo lectura)" },
];

export default function Usuarios() {
  const [users, setUsers] = useState<User[]>(mockUsers);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  
  const [formData, setFormData] = useState({
    email: "",
    name: "",
    role: "operativo" as UserRole,
    panelsAccess: [] as string[],
  });

  const resetForm = () => {
    setFormData({
      email: "",
      name: "",
      role: "operativo",
      panelsAccess: [],
    });
    setEditingUser(null);
  };

  const handleRoleChange = (role: UserRole) => {
    let panels: string[] = [];
    if (role === "administrador") {
      panels = PANELS.map(p => p.id);
    } else if (role === "operativo") {
      panels = ["general", "operaciones", "proveedores"];
    } else if (role === "visual") {
      panels = ["general", "directivo", "operaciones"];
    }
    setFormData({ ...formData, role, panelsAccess: panels });
  };

  const handlePanelToggle = (panelId: string) => {
    const current = formData.panelsAccess;
    if (current.includes(panelId)) {
      setFormData({ ...formData, panelsAccess: current.filter(p => p !== panelId) });
    } else {
      setFormData({ ...formData, panelsAccess: [...current, panelId] });
    }
  };

  const handleSave = () => {
    if (!formData.email || !formData.name) {
      toast.error("Por favor complete todos los campos requeridos");
      return;
    }

    if (editingUser) {
      setUsers(users.map(u => 
        u.id === editingUser.id 
          ? { ...u, ...formData }
          : u
      ));
      toast.success("Usuario actualizado exitosamente");
    } else {
      const newUser: User = {
        id: `u${Date.now()}`,
        ...formData,
      };
      setUsers([...users, newUser]);
      toast.success("Usuario agregado exitosamente");
    }

    setDialogOpen(false);
    resetForm();
  };

  const handleEdit = (user: User) => {
    setEditingUser(user);
    setFormData({
      email: user.email,
      name: user.name,
      role: user.role,
      panelsAccess: user.panelsAccess,
    });
    setDialogOpen(true);
  };

  const handleDelete = (userId: string) => {
    setUsers(users.filter(u => u.id !== userId));
    toast.success("Usuario eliminado");
  };

  const columns = [
    { key: "name", header: "Nombre", width: "200px", render: (u: User) => <span className="font-medium">{u.name}</span> },
    { key: "email", header: "Correo", width: "250px" },
    { key: "role", header: "Rol", width: "150px", render: (u: User) => (
      <Badge variant={u.role === "administrador" ? "default" : "secondary"} className="capitalize">
        {u.role}
      </Badge>
    )},
    { key: "panelsAccess", header: "Acceso a Paneles", width: "300px", render: (u: User) => (
      <div className="flex flex-wrap gap-1">
        {u.panelsAccess.slice(0, 3).map(p => (
          <Badge key={p} variant="outline" className="text-xs">{p}</Badge>
        ))}
        {u.panelsAccess.length > 3 && (
          <Badge variant="outline" className="text-xs">+{u.panelsAccess.length - 3}</Badge>
        )}
      </div>
    )},
    { key: "actions", header: "Acciones", width: "150px", render: (u: User) => (
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); handleEdit(u); }}>
          <Edit className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); setEditingUser(u); setPreviewOpen(true); }}>
          <Eye className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); handleDelete(u.id); }}>
          <Trash2 className="h-4 w-4 text-destructive" />
        </Button>
      </div>
    )},
  ];

  return (
    <Layout>
      <div className="space-y-6">
        <PanelHeader
          title="Gestión de Usuarios"
          description="Agregar y administrar usuarios del sistema"
        />

        <div className="flex justify-end">
          <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) resetForm(); }}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Agregar Usuario
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>{editingUser ? "Editar Usuario" : "Agregar Nuevo Usuario"}</DialogTitle>
              </DialogHeader>
              
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Correo Electrónico *</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="usuario@ejemplo.com"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="name">Nombre Completo *</Label>
                  <Input
                    id="name"
                    placeholder="Nombre del usuario"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="role">Rol</Label>
                  <Select value={formData.role} onValueChange={(v) => handleRoleChange(v as UserRole)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar rol" />
                    </SelectTrigger>
                    <SelectContent>
                      {ROLES.map(role => (
                        <SelectItem key={role.value} value={role.value}>
                          {role.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Acceso a Paneles</Label>
                  <div className="grid grid-cols-2 gap-2 p-3 border rounded-md bg-muted/30">
                    {PANELS.map(panel => (
                      <div key={panel.id} className="flex items-center space-x-2">
                        <Checkbox
                          id={panel.id}
                          checked={formData.panelsAccess.includes(panel.id)}
                          onCheckedChange={() => handlePanelToggle(panel.id)}
                          disabled={formData.role === "administrador"}
                        />
                        <label htmlFor={panel.id} className="text-sm cursor-pointer">
                          {panel.label}
                        </label>
                      </div>
                    ))}
                  </div>
                  {formData.role === "administrador" && (
                    <p className="text-xs text-muted-foreground">Los administradores tienen acceso a todos los paneles</p>
                  )}
                </div>
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => { setDialogOpen(false); resetForm(); }}>
                  Cancelar
                </Button>
                <Button onClick={handleSave}>
                  {editingUser ? "Guardar Cambios" : "Agregar Usuario"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        <div className="panel-card">
          <MatrixTable data={users} columns={columns} />
        </div>

        {/* Preview Dialog */}
        <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Vista Previa del Usuario</DialogTitle>
            </DialogHeader>
            {editingUser && (
              <div className="space-y-4">
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">Información del Usuario</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Nombre:</span>
                      <span className="font-medium">{editingUser.name}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Email:</span>
                      <span>{editingUser.email}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Rol:</span>
                      <Badge className="capitalize">{editingUser.role}</Badge>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">Paneles Accesibles</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 gap-2">
                      {PANELS.map(panel => {
                        const hasAccess = editingUser.panelsAccess.includes(panel.id);
                        return (
                          <div
                            key={panel.id}
                            className={`p-2 rounded-md text-sm ${hasAccess ? 'bg-primary/10 text-primary' : 'bg-muted/50 text-muted-foreground line-through'}`}
                          >
                            {panel.label}
                          </div>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">Permisos</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm">
                    <div className="flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-full ${editingUser.role === 'administrador' ? 'bg-green-500' : 'bg-muted'}`} />
                      <span>Editar estructura de campos</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-full ${editingUser.role !== 'visual' ? 'bg-green-500' : 'bg-muted'}`} />
                      <span>Editar contenido de proyectos</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-green-500" />
                      <span>Ver proyectos (según paneles)</span>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
}
