
-- Create gastos_menores table for minor expenses tracking
CREATE TABLE public.gastos_menores (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  centro_costos TEXT NOT NULL DEFAULT '',
  evento_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
  usuario_id UUID NOT NULL,
  usuario_nombre TEXT NOT NULL DEFAULT '',
  concepto TEXT NOT NULL DEFAULT '',
  categoria TEXT NOT NULL DEFAULT '',
  valor NUMERIC NOT NULL DEFAULT 0,
  imagen_url TEXT,
  estado TEXT NOT NULL DEFAULT 'Pendiente',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.gastos_menores ENABLE ROW LEVEL SECURITY;

-- Admins and operativos can view
CREATE POLICY "Admins and operativos can view gastos_menores"
ON public.gastos_menores FOR SELECT
USING (
  has_role(auth.uid(), 'administrador'::app_role) 
  OR has_role(auth.uid(), 'operativo'::app_role)
  OR has_role(auth.uid(), 'visual'::app_role)
);

-- Users with puede_crear_anticipos can insert
CREATE POLICY "Users with permission can insert gastos_menores"
ON public.gastos_menores FOR INSERT
WITH CHECK (
  auth.uid() = usuario_id
  AND (
    has_role(auth.uid(), 'administrador'::app_role)
    OR EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND puede_crear_anticipos = true
    )
  )
);

-- Admins can update (for status changes)
CREATE POLICY "Admins can update gastos_menores"
ON public.gastos_menores FOR UPDATE
USING (has_role(auth.uid(), 'administrador'::app_role));

-- Admins can delete
CREATE POLICY "Admins can delete gastos_menores"
ON public.gastos_menores FOR DELETE
USING (has_role(auth.uid(), 'administrador'::app_role));
