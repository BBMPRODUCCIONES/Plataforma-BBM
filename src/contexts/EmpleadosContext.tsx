import { createContext, useContext, useState, ReactNode } from "react";

export interface Empleado {
  id: string;
  cargo: string;
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
}

const initialEmpleados: Empleado[] = [
  { id: "e1", cargo: "Coordinador de Logística", nombre: "Juan Pérez", telefono: "+57 300 123 4567", correo: "juan.perez@bbm.com", createdAt: "2024-01-01T00:00:00Z" },
  { id: "e2", cargo: "Gerente de Operaciones", nombre: "Laura Martínez", telefono: "+57 301 234 5678", correo: "laura.martinez@bbm.com", createdAt: "2024-01-05T00:00:00Z" },
  { id: "e3", cargo: "Técnico de Montaje", nombre: "Carlos Ruiz", telefono: "+57 302 345 6789", correo: "carlos.ruiz@bbm.com", createdAt: "2024-01-10T00:00:00Z" },
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

  return (
    <EmpleadosContext.Provider value={{ 
      empleados, 
      addEmpleado, 
      updateEmpleado, 
      deleteEmpleado,
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
