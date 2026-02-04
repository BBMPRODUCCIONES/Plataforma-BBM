import { createContext, useContext, useState, useEffect, useCallback, ReactNode, useRef } from "react";
import { Project } from "@/types";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { logger } from "@/lib/logger";

// Helper function to send push notifications and create in-app notifications
async function sendPushNotification(
  headings: string, 
  contents: string, 
  url?: string,
  type: "info" | "success" | "warning" | "error" = "info"
) {
  try {
    const response = await supabase.functions.invoke("send-push-notification", {
      body: { 
        headings, 
        contents, 
        sendToAll: true, 
        url,
        type,
        createInAppNotifications: true,
      },
    });
    
    if (response.error) {
      console.error("[ProjectsContext] Push notification error:", response.error);
    } else {
      logger.debug("[ProjectsContext] Push notification sent:", response.data);
    }
  } catch (error) {
    console.error("[ProjectsContext] Failed to send push notification:", error);
  }
}
interface ProjectsContextType {
  projects: Project[];
  loading: boolean;
  addProject: (project: Partial<Project>) => Promise<Project | null>;
  updateProject: (projectId: string, field: string, value: any) => Promise<void>;
  updateProjectMultiple: (projectId: string, updates: Partial<Project>) => Promise<void>;
  deleteProject: (projectId: string) => Promise<void>;
  softDeleteProject: (projectId: string, userEmail: string, userId: string) => Promise<void>;
  restoreProject: (projectId: string) => Promise<void>;
  getProject: (projectId: string) => Project | undefined;
  refetch: () => Promise<void>;
}

const ProjectsContext = createContext<ProjectsContextType | null>(null);

// Convert database row to Project type
function dbRowToProject(row: any): Project {
  return {
    id: row.id,
    centroCostos: row.centro_costos || "",
    numFactura: row.num_factura || "",
    cliente: row.cliente || "",
    evento: row.evento || "",
    avanzada: row.avanzada || "NO_SE_HIZO",
    fechaMontajeInicio: row.fecha_montaje_inicio || "",
    fechaMontajeFin: row.fecha_montaje_fin || "",
    horaMontajeInicio: row.hora_montaje_inicio || "08:00",
    horaMontajeFin: row.hora_montaje_fin || "18:00",
    fechaEjecucionInicio: row.fecha_ejecucion_inicio || "",
    fechaEjecucionFin: row.fecha_ejecucion_fin || "",
    horaEjecucionInicio: row.hora_ejecucion_inicio || "09:00",
    horaEjecucionFin: row.hora_ejecucion_fin || "22:00",
    // Desmontaje fields
    fechaDesmontajeInicio: row.fecha_desmontaje_inicio || "",
    fechaDesmontajeFin: row.fecha_desmontaje_fin || "",
    horaDesmontajeInicio: row.hora_desmontaje_inicio || "18:00",
    horaDesmontajeFin: row.hora_desmontaje_fin || "22:00",
    estado: row.estado || "por_planear",
    administrativoResponsable: row.administrativo_responsable || "",
    ingresoTotal: Number(row.ingreso_total) || 0,
    ingresoBruto: Number(row.ingreso_bruto) || 0,
    ubicacion: row.ubicacion || "",
    jefeOperaciones: row.jefe_operaciones || "",
    productor: row.productor || "",
    aCargoDe: row.a_cargo_de || "",
    notas: row.notas || "",
    notasImagenes: row.notas_imagenes || [],
    personal: row.personal || [],
    inventario: row.inventario || [],
    cotizaciones: row.cotizaciones || [],
    ordenesCompra: row.ordenes_compra || [],
    notasCotizacionProveedor: row.notas_cotizacion_proveedor || "",
    cotizacionesProveedor: row.cotizaciones_proveedor || [],
    feedback: row.feedback || "",
    feedbackAdjuntos: row.feedback_adjuntos || [],
    cajaMenor: row.caja_menor || [],
    legalizacion: row.legalizacion || [],
    // Soft delete fields
    isDeleted: row.is_deleted || false,
    deletedAt: row.deleted_at || null,
    deletedBy: row.deleted_by || null,
    deletedByEmail: row.deleted_by_email || null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// Convert Project to database row format
function projectToDbRow(project: Partial<Project>): Record<string, any> {
  const row: Record<string, any> = {};
  
  if (project.centroCostos !== undefined) row.centro_costos = project.centroCostos;
  if (project.numFactura !== undefined) row.num_factura = project.numFactura;
  if (project.cliente !== undefined) row.cliente = project.cliente;
  if (project.evento !== undefined) row.evento = project.evento;
  if (project.avanzada !== undefined) row.avanzada = project.avanzada;
  if (project.fechaMontajeInicio !== undefined) row.fecha_montaje_inicio = project.fechaMontajeInicio;
  if (project.fechaMontajeFin !== undefined) row.fecha_montaje_fin = project.fechaMontajeFin;
  if (project.horaMontajeInicio !== undefined) row.hora_montaje_inicio = project.horaMontajeInicio;
  if (project.horaMontajeFin !== undefined) row.hora_montaje_fin = project.horaMontajeFin;
  if (project.fechaEjecucionInicio !== undefined) row.fecha_ejecucion_inicio = project.fechaEjecucionInicio;
  if (project.fechaEjecucionFin !== undefined) row.fecha_ejecucion_fin = project.fechaEjecucionFin;
  if (project.horaEjecucionInicio !== undefined) row.hora_ejecucion_inicio = project.horaEjecucionInicio;
  if (project.horaEjecucionFin !== undefined) row.hora_ejecucion_fin = project.horaEjecucionFin;
  // Desmontaje fields
  if (project.fechaDesmontajeInicio !== undefined) row.fecha_desmontaje_inicio = project.fechaDesmontajeInicio;
  if (project.fechaDesmontajeFin !== undefined) row.fecha_desmontaje_fin = project.fechaDesmontajeFin;
  if (project.horaDesmontajeInicio !== undefined) row.hora_desmontaje_inicio = project.horaDesmontajeInicio;
  if (project.horaDesmontajeFin !== undefined) row.hora_desmontaje_fin = project.horaDesmontajeFin;
  if (project.estado !== undefined) row.estado = project.estado;
  if (project.administrativoResponsable !== undefined) row.administrativo_responsable = project.administrativoResponsable;
  if (project.ingresoTotal !== undefined) row.ingreso_total = project.ingresoTotal;
  if (project.ingresoBruto !== undefined) row.ingreso_bruto = project.ingresoBruto;
  if (project.ubicacion !== undefined) row.ubicacion = project.ubicacion;
  if (project.jefeOperaciones !== undefined) row.jefe_operaciones = project.jefeOperaciones;
  if (project.productor !== undefined) row.productor = project.productor;
  if (project.aCargoDe !== undefined) row.a_cargo_de = project.aCargoDe;
  if (project.notas !== undefined) row.notas = project.notas;
  if (project.notasImagenes !== undefined) row.notas_imagenes = project.notasImagenes;
  if (project.personal !== undefined) row.personal = project.personal;
  if (project.inventario !== undefined) row.inventario = project.inventario;
  if (project.cotizaciones !== undefined) row.cotizaciones = project.cotizaciones;
  if (project.ordenesCompra !== undefined) row.ordenes_compra = project.ordenesCompra;
  if (project.notasCotizacionProveedor !== undefined) row.notas_cotizacion_proveedor = project.notasCotizacionProveedor;
  if (project.cotizacionesProveedor !== undefined) row.cotizaciones_proveedor = project.cotizacionesProveedor;
  if (project.feedback !== undefined) row.feedback = project.feedback;
  if (project.feedbackAdjuntos !== undefined) row.feedback_adjuntos = project.feedbackAdjuntos;
  if (project.cajaMenor !== undefined) row.caja_menor = project.cajaMenor;
  if (project.legalizacion !== undefined) row.legalizacion = project.legalizacion;
  
  return row;
}

// Map single field name to db column
function fieldToColumn(field: string): string {
  const mapping: Record<string, string> = {
    centroCostos: "centro_costos",
    numFactura: "num_factura",
    fechaMontajeInicio: "fecha_montaje_inicio",
    fechaMontajeFin: "fecha_montaje_fin",
    horaMontajeInicio: "hora_montaje_inicio",
    horaMontajeFin: "hora_montaje_fin",
    fechaEjecucionInicio: "fecha_ejecucion_inicio",
    fechaEjecucionFin: "fecha_ejecucion_fin",
    horaEjecucionInicio: "hora_ejecucion_inicio",
    horaEjecucionFin: "hora_ejecucion_fin",
    // Desmontaje fields
    fechaDesmontajeInicio: "fecha_desmontaje_inicio",
    fechaDesmontajeFin: "fecha_desmontaje_fin",
    horaDesmontajeInicio: "hora_desmontaje_inicio",
    horaDesmontajeFin: "hora_desmontaje_fin",
    administrativoResponsable: "administrativo_responsable",
    ingresoTotal: "ingreso_total",
    ingresoBruto: "ingreso_bruto",
    jefeOperaciones: "jefe_operaciones",
    aCargoDe: "a_cargo_de",
    ordenesCompra: "ordenes_compra",
    notasCotizacionProveedor: "notas_cotizacion_proveedor",
    cotizacionesProveedor: "cotizaciones_proveedor",
    notasImagenes: "notas_imagenes",
    feedback: "feedback",
    feedbackAdjuntos: "feedback_adjuntos",
    cajaMenor: "caja_menor",
  };
  return mapping[field] || field;
}

export function ProjectsProvider({ children }: { children: ReactNode }) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const { user, loading: authLoading } = useAuth();
  const dataLoadedRef = useRef(false);

  const fetchProjects = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from("projects")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) {
        console.error("[ProjectsContext] Error fetching projects:", error);
        toast.error("Error al cargar proyectos");
        return;
      }

      const projectsList = (data || []).map(dbRowToProject);
      setProjects(projectsList);
      logger.debug("[ProjectsContext] Loaded", projectsList.length, "projects");
    } catch (err) {
      console.error("[ProjectsContext] Unexpected error:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Conditional fetch: only when user is authenticated
  useEffect(() => {
    // Wait for auth to finish loading
    if (authLoading) return;
    
    // If no user, skip loading data
    if (!user) {
      setLoading(false);
      setProjects([]);
      dataLoadedRef.current = false;
      return;
    }

    // Avoid re-fetching if already loaded for this session
    if (dataLoadedRef.current) return;

    logger.debug("[ProjectsContext] User authenticated, fetching projects...");
    dataLoadedRef.current = true;
    fetchProjects();

    // Subscribe to realtime changes only when authenticated
    const channel = supabase
      .channel("projects-changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "projects" },
        (payload) => {
          logger.debug("[ProjectsContext] Realtime event:", payload.eventType);
          
          if (payload.eventType === "INSERT") {
            const newProject = dbRowToProject(payload.new);
            // Skip if this insert was already handled optimistically
            if (pendingInsertIdsRef.current.has(newProject.id)) {
              logger.debug("[ProjectsContext] Skipping realtime INSERT for pending project:", newProject.id);
              return;
            }
            setProjects(prev => {
              // Also check if already exists to prevent duplicates
              if (prev.some(p => p.id === newProject.id)) {
                return prev;
              }
              return [newProject, ...prev];
            });
          } else if (payload.eventType === "UPDATE") {
            const updatedProject = dbRowToProject(payload.new);
            setProjects(prev => prev.map(p => p.id === updatedProject.id ? updatedProject : p));
          } else if (payload.eventType === "DELETE") {
            const deletedId = payload.old.id;
            setProjects(prev => prev.filter(p => p.id !== deletedId));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, authLoading, fetchProjects]);

  // Track pending insert IDs to prevent realtime duplicates
  const pendingInsertIdsRef = useRef<Set<string>>(new Set());

  const addProject = useCallback(async (projectData: Partial<Project>): Promise<Project | null> => {
    // Create optimistic project with temporary ID
    const tempId = `temp-${Date.now()}`;
    const optimisticProject: Project = {
      id: tempId,
      centroCostos: projectData.centroCostos || "",
      numFactura: projectData.numFactura || "",
      cliente: projectData.cliente || "",
      evento: projectData.evento || "",
      avanzada: projectData.avanzada || "NO_SE_HIZO",
      fechaMontajeInicio: projectData.fechaMontajeInicio || new Date().toISOString().split("T")[0],
      fechaMontajeFin: projectData.fechaMontajeFin || new Date().toISOString().split("T")[0],
      horaMontajeInicio: projectData.horaMontajeInicio || "08:00",
      horaMontajeFin: projectData.horaMontajeFin || "18:00",
      fechaEjecucionInicio: projectData.fechaEjecucionInicio || new Date().toISOString().split("T")[0],
      fechaEjecucionFin: projectData.fechaEjecucionFin || new Date().toISOString().split("T")[0],
      horaEjecucionInicio: projectData.horaEjecucionInicio || "09:00",
      horaEjecucionFin: projectData.horaEjecucionFin || "22:00",
      // Desmontaje fields
      fechaDesmontajeInicio: projectData.fechaDesmontajeInicio || "",
      fechaDesmontajeFin: projectData.fechaDesmontajeFin || "",
      horaDesmontajeInicio: projectData.horaDesmontajeInicio || "18:00",
      horaDesmontajeFin: projectData.horaDesmontajeFin || "22:00",
      estado: projectData.estado || "por_planear",
      administrativoResponsable: projectData.administrativoResponsable || "",
      ingresoTotal: projectData.ingresoTotal || 0,
      ingresoBruto: projectData.ingresoBruto || 0,
      ubicacion: projectData.ubicacion || "",
      jefeOperaciones: projectData.jefeOperaciones || "",
      productor: projectData.productor || "",
      aCargoDe: projectData.aCargoDe || "",
      notas: projectData.notas || "",
      personal: projectData.personal || [],
      inventario: projectData.inventario || [],
      cotizaciones: projectData.cotizaciones || [],
      ordenesCompra: projectData.ordenesCompra || [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // Optimistic update - add immediately
    setProjects(prev => [optimisticProject, ...prev]);

    const newProjectData = {
      centro_costos: optimisticProject.centroCostos,
      num_factura: optimisticProject.numFactura,
      cliente: optimisticProject.cliente,
      evento: optimisticProject.evento,
      avanzada: optimisticProject.avanzada,
      fecha_montaje_inicio: optimisticProject.fechaMontajeInicio,
      fecha_montaje_fin: optimisticProject.fechaMontajeFin,
      hora_montaje_inicio: optimisticProject.horaMontajeInicio,
      hora_montaje_fin: optimisticProject.horaMontajeFin,
      fecha_ejecucion_inicio: optimisticProject.fechaEjecucionInicio,
      fecha_ejecucion_fin: optimisticProject.fechaEjecucionFin,
      hora_ejecucion_inicio: optimisticProject.horaEjecucionInicio,
      hora_ejecucion_fin: optimisticProject.horaEjecucionFin,
      // Desmontaje fields
      fecha_desmontaje_inicio: optimisticProject.fechaDesmontajeInicio,
      fecha_desmontaje_fin: optimisticProject.fechaDesmontajeFin,
      hora_desmontaje_inicio: optimisticProject.horaDesmontajeInicio,
      hora_desmontaje_fin: optimisticProject.horaDesmontajeFin,
      estado: optimisticProject.estado,
      administrativo_responsable: optimisticProject.administrativoResponsable,
      ingreso_total: optimisticProject.ingresoTotal,
      ingreso_bruto: optimisticProject.ingresoBruto,
      ubicacion: optimisticProject.ubicacion,
      jefe_operaciones: optimisticProject.jefeOperaciones,
      productor: optimisticProject.productor,
      a_cargo_de: optimisticProject.aCargoDe,
      notas: optimisticProject.notas,
      personal: JSON.parse(JSON.stringify(optimisticProject.personal)),
      inventario: JSON.parse(JSON.stringify(optimisticProject.inventario)),
      cotizaciones: JSON.parse(JSON.stringify(optimisticProject.cotizaciones)),
      ordenes_compra: JSON.parse(JSON.stringify(optimisticProject.ordenesCompra)),
    };

    const { data, error } = await supabase
      .from("projects")
      .insert(newProjectData)
      .select()
      .single();

    if (error) {
      console.error("[ProjectsContext] Error creating project:", error);
      toast.error("Error al crear el proyecto");
      // Revert optimistic update
      setProjects(prev => prev.filter(p => p.id !== tempId));
      return null;
    }

    // Mark this ID as pending to prevent realtime duplicate
    pendingInsertIdsRef.current.add(data.id);

    // Replace temp project with real one
    const realProject = dbRowToProject(data);
    setProjects(prev => prev.map(p => p.id === tempId ? realProject : p));
    logger.debug("[ProjectsContext] Created new project:", data.id);

    // Send push notification and create in-app notifications for new project
    const eventName = realProject.evento || "Nuevo evento";
    const clientName = realProject.cliente || "";
    sendPushNotification(
      "🎉 Nuevo Evento Creado",
      clientName ? `${eventName} - ${clientName}` : eventName,
      `/panel-directivo`,
      "success"
    );

    // Clear the pending ID after a short delay (to allow realtime event to be ignored)
    setTimeout(() => {
      pendingInsertIdsRef.current.delete(data.id);
    }, 2000);

    return realProject;
  }, []);

  const updateProject = useCallback(async (projectId: string, field: string, value: any) => {
    // Optimistic update - update local state immediately
    setProjects(prev => prev.map(p => 
      p.id === projectId ? { ...p, [field]: value } : p
    ));

    const columnName = fieldToColumn(field);
    const { error } = await supabase
      .from("projects")
      .update({ [columnName]: value })
      .eq("id", projectId);

    if (error) {
      console.error("[ProjectsContext] Error updating project:", error);
      toast.error("Error al actualizar el proyecto");
      await fetchProjects(); // Revert on error
      return;
    }

    logger.debug("[ProjectsContext] Updated project", projectId, "field:", field);
  }, [fetchProjects]);

  const updateProjectMultiple = useCallback(async (projectId: string, updates: Partial<Project>) => {
    // Optimistic update - update local state immediately
    setProjects(prev => prev.map(p => 
      p.id === projectId ? { ...p, ...updates } : p
    ));

    const dbUpdates = projectToDbRow(updates);
    const { error } = await supabase
      .from("projects")
      .update(dbUpdates)
      .eq("id", projectId);

    if (error) {
      console.error("[ProjectsContext] Error updating project:", error);
      toast.error("Error al actualizar el proyecto");
      await fetchProjects(); // Revert on error
      return;
    }

    logger.debug("[ProjectsContext] Updated project", projectId, "with multiple fields");
  }, [fetchProjects]);

  const deleteProject = useCallback(async (projectId: string) => {
    // Save for potential rollback
    const projectToDelete = projects.find(p => p.id === projectId);
    
    // Optimistic update - remove immediately
    setProjects(prev => prev.filter(p => p.id !== projectId));

    const { error } = await supabase
      .from("projects")
      .delete()
      .eq("id", projectId);

    if (error) {
      console.error("[ProjectsContext] Error deleting project:", error);
      toast.error("Error al eliminar el proyecto");
      // Revert optimistic update
      if (projectToDelete) {
        setProjects(prev => [projectToDelete, ...prev]);
      }
      return;
    }

    logger.debug("[ProjectsContext] Deleted project:", projectId);
  }, [projects]);

  const softDeleteProject = useCallback(async (projectId: string, userEmail: string, userId: string) => {
    // Optimistic update - mark as deleted locally
    setProjects(prev => prev.map(p => 
      p.id === projectId 
        ? { ...p, isDeleted: true, deletedAt: new Date().toISOString(), deletedBy: userId, deletedByEmail: userEmail }
        : p
    ));

    const { error } = await supabase
      .from("projects")
      .update({ 
        is_deleted: true, 
        deleted_at: new Date().toISOString(),
        deleted_by: userId,
        deleted_by_email: userEmail
      })
      .eq("id", projectId);

    if (error) {
      console.error("[ProjectsContext] Error soft-deleting project:", error);
      toast.error("Error al eliminar el evento");
      await fetchProjects(); // Revert on error
      return;
    }

    // Send push notification and create in-app notifications for deleted project
    const deletedProject = projects.find(p => p.id === projectId);
    if (deletedProject) {
      const eventName = deletedProject.evento || "Evento";
      sendPushNotification(
        "🗑️ Evento Eliminado",
        eventName,
        `/panel-directivo`,
        "warning"
      );
    }

    toast.success("Evento eliminado correctamente");
    logger.debug("[ProjectsContext] Soft-deleted project:", projectId);
  }, [fetchProjects]);

  const restoreProject = useCallback(async (projectId: string) => {
    // Get project before restore for notification
    const projectToRestore = projects.find(p => p.id === projectId);
    
    // Optimistic update - restore locally
    setProjects(prev => prev.map(p => 
      p.id === projectId 
        ? { ...p, isDeleted: false, deletedAt: undefined, deletedBy: undefined, deletedByEmail: undefined }
        : p
    ));

    const { error } = await supabase
      .from("projects")
      .update({ 
        is_deleted: false, 
        deleted_at: null,
        deleted_by: null,
        deleted_by_email: null
      })
      .eq("id", projectId);

    if (error) {
      console.error("[ProjectsContext] Error restoring project:", error);
      toast.error("Error al restaurar el evento");
      await fetchProjects(); // Revert on error
      return;
    }

    // Send push notification and create in-app notifications for restored project
    if (projectToRestore) {
      const eventName = projectToRestore.evento || "Evento";
      sendPushNotification(
        "♻️ Evento Restaurado",
        eventName,
        `/panel-directivo`,
        "success"
      );
    }

    toast.success("Evento restaurado correctamente");
    logger.debug("[ProjectsContext] Restored project:", projectId);
  }, [projects, fetchProjects]);

  const getProject = useCallback((projectId: string) => {
    return projects.find(p => p.id === projectId);
  }, [projects]);

  return (
    <ProjectsContext.Provider value={{
      projects,
      loading,
      addProject,
      updateProject,
      updateProjectMultiple,
      deleteProject,
      softDeleteProject,
      restoreProject,
      getProject,
      refetch: fetchProjects,
    }}>
      {children}
    </ProjectsContext.Provider>
  );
}

export function useProjects() {
  const context = useContext(ProjectsContext);
  if (!context) {
    throw new Error("useProjects must be used within ProjectsProvider");
  }
  return context;
}
