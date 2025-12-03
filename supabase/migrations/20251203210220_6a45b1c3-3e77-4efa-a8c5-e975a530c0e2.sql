
-- Create projects table
CREATE TABLE public.projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  centro_costos TEXT NOT NULL DEFAULT '',
  num_factura TEXT NOT NULL DEFAULT '',
  cliente TEXT NOT NULL DEFAULT '',
  evento TEXT NOT NULL DEFAULT '',
  avanzada TEXT NOT NULL DEFAULT 'NO_SE_HIZO',
  fecha_montaje_inicio TEXT NOT NULL DEFAULT '',
  fecha_montaje_fin TEXT NOT NULL DEFAULT '',
  hora_montaje_inicio TEXT NOT NULL DEFAULT '08:00',
  hora_montaje_fin TEXT NOT NULL DEFAULT '18:00',
  fecha_ejecucion_inicio TEXT NOT NULL DEFAULT '',
  fecha_ejecucion_fin TEXT NOT NULL DEFAULT '',
  hora_ejecucion_inicio TEXT NOT NULL DEFAULT '09:00',
  hora_ejecucion_fin TEXT NOT NULL DEFAULT '22:00',
  estado TEXT NOT NULL DEFAULT 'por_planear',
  administrativo_responsable TEXT NOT NULL DEFAULT '',
  ingreso_total NUMERIC NOT NULL DEFAULT 0,
  ingreso_bruto NUMERIC NOT NULL DEFAULT 0,
  ubicacion TEXT NOT NULL DEFAULT '',
  jefe_operaciones TEXT NOT NULL DEFAULT '',
  productor TEXT NOT NULL DEFAULT '',
  a_cargo_de TEXT NOT NULL DEFAULT '',
  notas TEXT NOT NULL DEFAULT '',
  personal JSONB NOT NULL DEFAULT '[]'::jsonb,
  inventario JSONB NOT NULL DEFAULT '[]'::jsonb,
  cotizaciones JSONB NOT NULL DEFAULT '[]'::jsonb,
  ordenes_compra JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create employees table
CREATE TABLE public.employees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cargo TEXT NOT NULL DEFAULT '',
  nombre TEXT NOT NULL DEFAULT '',
  telefono TEXT NOT NULL DEFAULT '',
  correo TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create clients table
CREATE TABLE public.clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre TEXT NOT NULL DEFAULT '',
  nit TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;

-- RLS Policies for projects
CREATE POLICY "Authenticated users can view all projects"
ON public.projects FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Admins can insert projects"
ON public.projects FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'administrador'));

CREATE POLICY "Admins and operativos can update projects"
ON public.projects FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'administrador') OR public.has_role(auth.uid(), 'operativo'));

CREATE POLICY "Admins can delete projects"
ON public.projects FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'administrador'));

-- RLS Policies for employees
CREATE POLICY "Authenticated users can view all employees"
ON public.employees FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Admins can insert employees"
ON public.employees FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'administrador'));

CREATE POLICY "Admins can update employees"
ON public.employees FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'administrador'));

CREATE POLICY "Admins can delete employees"
ON public.employees FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'administrador'));

-- RLS Policies for clients
CREATE POLICY "Authenticated users can view all clients"
ON public.clients FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Admins can insert clients"
ON public.clients FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'administrador'));

CREATE POLICY "Admins can update clients"
ON public.clients FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'administrador'));

CREATE POLICY "Admins can delete clients"
ON public.clients FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'administrador'));

-- Enable realtime for all tables
ALTER PUBLICATION supabase_realtime ADD TABLE public.projects;
ALTER PUBLICATION supabase_realtime ADD TABLE public.employees;
ALTER PUBLICATION supabase_realtime ADD TABLE public.clients;

-- Update trigger for projects
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_projects_updated_at
BEFORE UPDATE ON public.projects
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
