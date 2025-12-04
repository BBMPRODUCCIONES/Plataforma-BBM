-- Create suppliers/proveedores table
CREATE TABLE public.suppliers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  categoria TEXT NOT NULL DEFAULT '',
  nombre TEXT NOT NULL DEFAULT '',
  telefono TEXT NOT NULL DEFAULT '',
  correo TEXT NOT NULL DEFAULT '',
  tipo_producto_servicio TEXT NOT NULL DEFAULT '',
  notas TEXT NOT NULL DEFAULT '',
  cotizaciones JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;

-- Create policies - authenticated users can view
CREATE POLICY "Authenticated users can view suppliers" 
ON public.suppliers 
FOR SELECT 
USING (true);

-- Admins can insert
CREATE POLICY "Admins can insert suppliers" 
ON public.suppliers 
FOR INSERT 
WITH CHECK (has_role(auth.uid(), 'administrador'::app_role));

-- Admins and operativos can update
CREATE POLICY "Admins and operativos can update suppliers" 
ON public.suppliers 
FOR UPDATE 
USING (has_role(auth.uid(), 'administrador'::app_role) OR has_role(auth.uid(), 'operativo'::app_role));

-- Admins can delete
CREATE POLICY "Admins can delete suppliers" 
ON public.suppliers 
FOR DELETE 
USING (has_role(auth.uid(), 'administrador'::app_role));

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_suppliers_updated_at
BEFORE UPDATE ON public.suppliers
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();