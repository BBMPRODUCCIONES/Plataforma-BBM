import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react";
import { Project } from "@/types";
import { mockProjects } from "@/data/mockData";

const STORAGE_KEY = "app-projects";

interface ProjectsContextType {
  projects: Project[];
  addProject: (project: Partial<Project>) => Project;
  updateProject: (projectId: string, field: string, value: any) => void;
  updateProjectMultiple: (projectId: string, updates: Partial<Project>) => void;
  deleteProject: (projectId: string) => void;
  getProject: (projectId: string) => Project | undefined;
}

const ProjectsContext = createContext<ProjectsContextType | null>(null);

export function ProjectsProvider({ children }: { children: ReactNode }) {
  const [projects, setProjects] = useState<Project[]>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) {
          console.log("[ProjectsContext] Loaded", parsed.length, "projects from localStorage");
          return parsed;
        }
      }
    } catch (e) {
      console.error("[ProjectsContext] Error loading from localStorage:", e);
    }
    // Initialize with mock data if nothing stored
    console.log("[ProjectsContext] Initializing with mock data");
    return mockProjects;
  });

  // Persist to localStorage whenever projects change
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(projects));
      console.log("[ProjectsContext] Saved", projects.length, "projects to localStorage");
    } catch (e) {
      console.error("[ProjectsContext] Error saving to localStorage:", e);
    }
  }, [projects]);

  const addProject = useCallback((projectData: Partial<Project>): Project => {
    const newProject: Project = {
      id: `proj-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
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

    setProjects(prev => [...prev, newProject]);
    console.log("[ProjectsContext] Created new project:", newProject.id);
    return newProject;
  }, []);

  const updateProject = useCallback((projectId: string, field: string, value: any) => {
    setProjects(prev => prev.map(p =>
      p.id === projectId
        ? { ...p, [field]: value, updatedAt: new Date().toISOString() }
        : p
    ));
    console.log("[ProjectsContext] Updated project", projectId, "field:", field);
  }, []);

  const updateProjectMultiple = useCallback((projectId: string, updates: Partial<Project>) => {
    setProjects(prev => prev.map(p =>
      p.id === projectId
        ? { ...p, ...updates, updatedAt: new Date().toISOString() }
        : p
    ));
    console.log("[ProjectsContext] Updated project", projectId, "with multiple fields");
  }, []);

  const deleteProject = useCallback((projectId: string) => {
    setProjects(prev => prev.filter(p => p.id !== projectId));
    console.log("[ProjectsContext] Deleted project:", projectId);
  }, []);

  const getProject = useCallback((projectId: string) => {
    return projects.find(p => p.id === projectId);
  }, [projects]);

  return (
    <ProjectsContext.Provider value={{
      projects,
      addProject,
      updateProject,
      updateProjectMultiple,
      deleteProject,
      getProject,
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
