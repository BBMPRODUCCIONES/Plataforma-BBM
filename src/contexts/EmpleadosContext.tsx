import { createContext, useContext, useState, ReactNode } from "react";

export interface Empleado {
  id: string;
  categoria: "BBM" | "Proveedor" | "Transporte";
  nombre: string;
  telefono: string;
  correo: string;
  createdAt: string;
  [key: string]: any;
}

interface EmpleadosContextType {
  empleados: Empleado[];
  addEmpleado: (empleado: Empleado) => void;
  updateEmpleado: (id: string, data: Partial<Empleado>) => void;
  deleteEmpleado: (id: string) => void;
  getEmpleadosByCategoria: (categoria: "BBM" | "Proveedor" | "Transporte") => Empleado[];
}

const initialEmpleados: Empleado[] = [
  { id: "e1", categoria: "BBM", nombre: "Juan Pérez", telefono: "+57 300 123 4567", correo: "juan.perez@bbm.com", createdAt: "2024-01-01T00:00:00Z" },
  { id: "e2", categoria: "BBM", nombre: "Laura Martínez", telefono: "+57 301 234 5678", correo: "laura.martinez@bbm.com", createdAt: "2024-01-05T00:00:00Z" },
  { id: "e3", categoria: "BBM", nombre: "Carlos Ruiz", telefono: "+57 302 345 6789", correo: "carlos.ruiz@bbm.com", createdAt: "2024-01-10T00:00:00Z" },
  { id: "e4", categoria: "Proveedor", nombre: "Diego Morales", telefono: "+57 303 456 7890", correo: "diego@proveedor.com", createdAt: "2024-01-15T00:00:00Z" },
  { id: "e5", categoria: "Transporte", nombre: "Andrés López", telefono: "+57 304 567 8901", correo: "andres@transporte.com", createdAt: "2024-01-20T00:00:00Z" },
];

const EmpleadosContext = createContext<EmpleadosContextType | undefined>(undefined);

export function EmpleadosProvider({ children }: { children: ReactNode }) {
  const [empleados, setEmpleados] = useState<Empleado[]>(initialEmpleados);

  const addEmpleado = (empleado: Empleado) => {
    setEmpleados(prev => [...prev, empleado]);
  };

  const updateEmpleado = (id: string, data: Partial<Empleado>) => {
    setEmpleados(prev => prev.map(e => 
      e.id === id ? { ...e, ...data } : e
    ));
  };

  const deleteEmpleado = (id: string) => {
    setEmpleados(prev => prev.filter(e => e.id !== id));
  };

  const getEmpleadosByCategoria = (categoria: "BBM" | "Proveedor" | "Transporte") => {
    return empleados.filter(e => e.categoria === categoria);
  };

  return (
    <EmpleadosContext.Provider value={{ 
      empleados, 
      addEmpleado, 
      updateEmpleado, 
      deleteEmpleado,
      getEmpleadosByCategoria 
    }}>
      {children}
    </EmpleadosContext.Provider>
  );
}

export function useEmpleados() {
  const context = useContext(EmpleadosContext);
  if (!context) {
    throw new Error("useEmpleados must be used within EmpleadosProvider");
  }
  return context;
}
