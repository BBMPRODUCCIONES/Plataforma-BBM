-- Create horarios table for employee schedule management
CREATE TABLE public.horarios (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  empleado_id UUID REFERENCES public.employees(id) ON DELETE CASCADE,
  evento_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
  evento_nombre TEXT NOT NULL DEFAULT '',
  cargo TEXT NOT NULL DEFAULT '',
  dia DATE NOT NULL,
  categoria TEXT NOT NULL DEFAULT 'Oficina' CHECK (categoria IN ('Oficina', 'Evento')),
  llegada TEXT NOT NULL DEFAULT '08:00',
  ubicacion_llegada TEXT NOT NULL DEFAULT '',
  salida TEXT NOT NULL DEFAULT '18:00',
  ubicacion_salida TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.horarios ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Admins can view all horarios"
ON public.horarios
FOR SELECT
USING (has_role(auth.uid(), 'administrador'::app_role));

CREATE POLICY "Admins can insert horarios"
ON public.horarios
FOR INSERT
WITH CHECK (has_role(auth.uid(), 'administrador'::app_role));

CREATE POLICY "Admins can update horarios"
ON public.horarios
FOR UPDATE
USING (has_role(auth.uid(), 'administrador'::app_role));

CREATE POLICY "Admins can delete horarios"
ON public.horarios
FOR DELETE
USING (has_role(auth.uid(), 'administrador'::app_role));

-- Enable realtime
ALTER TABLE public.horarios REPLICA IDENTITY FULL;

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_horarios_updated_at
BEFORE UPDATE ON public.horarios
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();