import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react";
import { Project } from "@/types";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface ProjectsContextType {
  projects: Project[];
  loading: boolean;
  addProject: (project: Partial<Project>) => Promise<Project | null>;
  updateProject: (projectId: string, field: string, value: any) => Promise<void>;
  updateProjectMultiple: (projectId: string, updates: Partial<Project>) => Promise<void>;
  deleteProject: (projectId: string) => Promise<void>;
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
    estado: row.estado || "por_planear",
    administrativoResponsable: row.administrativo_responsable || "",
    ingresoTotal: Number(row.ingreso_total) || 0,
    ingresoBruto: Number(row.ingreso_bruto) || 0,
    ubicacion: row.ubicacion || "",
    jefeOperaciones: row.jefe_operaciones || "",
    productor: row.productor || "",
    aCargoDe: row.a_cargo_de || "",
    notas: row.notas || "",
    personal: row.personal || [],
    inventario: row.inventario || [],
    cotizaciones: row.cotizaciones || [],
    ordenesCompra: row.ordenes_compra || [],
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
  if (project.estado !== undefined) row.estado = project.estado;
  if (project.administrativoResponsable !== undefined) row.administrativo_responsable = project.administrativoResponsable;
  if (project.ingresoTotal !== undefined) row.ingreso_total = project.ingresoTotal;
  if (project.ingresoBruto !== undefined) row.ingreso_bruto = project.ingresoBruto;
  if (project.ubicacion !== undefined) row.ubicacion = project.ubicacion;
  if (project.jefeOperaciones !== undefined) row.jefe_operaciones = project.jefeOperaciones;
  if (project.productor !== undefined) row.productor = project.productor;
  if (project.aCargoDe !== undefined) row.a_cargo_de = project.aCargoDe;
  if (project.notas !== undefined) row.notas = project.notas;
  if (project.personal !== undefined) row.personal = project.personal;
  if (project.inventario !== undefined) row.inventario = project.inventario;
  if (project.cotizaciones !== undefined) row.cotizaciones = project.cotizaciones;
  if (project.ordenesCompra !== undefined) row.ordenes_compra = project.ordenesCompra;
  
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
    administrativoResponsable: "administrativo_responsable",
    ingresoTotal: "ingreso_total",
    ingresoBruto: "ingreso_bruto",
    jefeOperaciones: "jefe_operaciones",
    aCargoDe: "a_cargo_de",
    ordenesCompra: "ordenes_compra",
  };
  return mapping[field] || field;
}

export function ProjectsProvider({ children }: { children: ReactNode }) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);

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
      console.log("[ProjectsContext] Loaded", projectsList.length, "projects from database");
    } catch (err) {
      console.error("[ProjectsContext] Unexpected error:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial fetch and realtime subscription
  useEffect(() => {
    fetchProjects();

    // Subscribe to realtime changes
    const channel = supabase
      .channel("projects-changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "projects" },
        (payload) => {
          console.log("[ProjectsContext] Realtime event:", payload.eventType);
          
          if (payload.eventType === "INSERT") {
            const newProject = dbRowToProject(payload.new);
            setProjects(prev => [newProject, ...prev]);
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
  }, [fetchProjects]);

  const addProject = useCallback(async (projectData: Partial<Project>): Promise<Project | null> => {
    const newProjectData = {
      centro_costos: projectData.centroCostos || "",
      num_factura: projectData.numFactura || "",
      cliente: projectData.cliente || "",
      evento: projectData.evento || "",
      avanzada: projectData.avanzada || "NO_SE_HIZO",
      fecha_montaje_inicio: projectData.fechaMontajeInicio || new Date().toISOString().split("T")[0],
      fecha_montaje_fin: projectData.fechaMontajeFin || new Date().toISOString().split("T")[0],
      hora_montaje_inicio: projectData.horaMontajeInicio || "08:00",
      hora_montaje_fin: projectData.horaMontajeFin || "18:00",
      fecha_ejecucion_inicio: projectData.fechaEjecucionInicio || new Date().toISOString().split("T")[0],
      fecha_ejecucion_fin: projectData.fechaEjecucionFin || new Date().toISOString().split("T")[0],
      hora_ejecucion_inicio: projectData.horaEjecucionInicio || "09:00",
      hora_ejecucion_fin: projectData.horaEjecucionFin || "22:00",
      estado: projectData.estado || "por_planear",
      administrativo_responsable: projectData.administrativoResponsable || "",
      ingreso_total: projectData.ingresoTotal || 0,
      ingreso_bruto: projectData.ingresoBruto || 0,
      ubicacion: projectData.ubicacion || "",
      jefe_operaciones: projectData.jefeOperaciones || "",
      productor: projectData.productor || "",
      a_cargo_de: projectData.aCargoDe || "",
      notas: projectData.notas || "",
      personal: JSON.parse(JSON.stringify(projectData.personal || [])),
      inventario: JSON.parse(JSON.stringify(projectData.inventario || [])),
      cotizaciones: JSON.parse(JSON.stringify(projectData.cotizaciones || [])),
      ordenes_compra: JSON.parse(JSON.stringify(projectData.ordenesCompra || [])),
    };

    const { data, error } = await supabase
      .from("projects")
      .insert(newProjectData)
      .select()
      .single();

    if (error) {
      console.error("[ProjectsContext] Error creating project:", error);
      toast.error("Error al crear el proyecto");
      return null;
    }

    console.log("[ProjectsContext] Created new project:", data.id);
    return dbRowToProject(data);
  }, []);

  const updateProject = useCallback(async (projectId: string, field: string, value: any) => {
    const columnName = fieldToColumn(field);
    
    const { error } = await supabase
      .from("projects")
      .update({ [columnName]: value })
      .eq("id", projectId);

    if (error) {
      console.error("[ProjectsContext] Error updating project:", error);
      toast.error("Error al actualizar el proyecto");
      return;
    }

    console.log("[ProjectsContext] Updated project", projectId, "field:", field);
  }, []);

  const updateProjectMultiple = useCallback(async (projectId: string, updates: Partial<Project>) => {
    const dbUpdates = projectToDbRow(updates);

    const { error } = await supabase
      .from("projects")
      .update(dbUpdates)
      .eq("id", projectId);

    if (error) {
      console.error("[ProjectsContext] Error updating project:", error);
      toast.error("Error al actualizar el proyecto");
      return;
    }

    console.log("[ProjectsContext] Updated project", projectId, "with multiple fields");
  }, []);

  const deleteProject = useCallback(async (projectId: string) => {
    const { error } = await supabase
      .from("projects")
      .delete()
      .eq("id", projectId);

    if (error) {
      console.error("[ProjectsContext] Error deleting project:", error);
      toast.error("Error al eliminar el proyecto");
      return;
    }

    console.log("[ProjectsContext] Deleted project:", projectId);
  }, []);

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
