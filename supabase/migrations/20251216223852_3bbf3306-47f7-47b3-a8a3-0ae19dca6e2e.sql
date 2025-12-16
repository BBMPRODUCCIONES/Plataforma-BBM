-- Create table for supplier cotizacion history
CREATE TABLE public.supplier_cotizacion_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  proveedor_id UUID NOT NULL REFERENCES public.suppliers(id) ON DELETE CASCADE,
  evento_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
  fecha TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  -- Snapshot fields from supplier at time of upload
  proveedor_nombre TEXT NOT NULL,
  proveedor_categoria TEXT NOT NULL DEFAULT '',
  proveedor_telefono TEXT NOT NULL DEFAULT '',
  proveedor_correo TEXT NOT NULL DEFAULT '',
  proveedor_tipo_producto_servicio TEXT NOT NULL DEFAULT '',
  -- File information
  file_name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_size INTEGER DEFAULT 0,
  -- Audit fields
  uploaded_by UUID REFERENCES auth.users(id),
  uploaded_by_email TEXT,
  deleted_at TIMESTAMP WITH TIME ZONE,
  deleted_by UUID,
  deleted_by_email TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.supplier_cotizacion_history ENABLE ROW LEVEL SECURITY;

-- Policies: same as suppliers table (admin and operativo can view, admin can insert/delete, both can update)
CREATE POLICY "Admins and operativos can view cotizacion history"
ON public.supplier_cotizacion_history
FOR SELECT
USING (has_role(auth.uid(), 'administrador'::app_role) OR has_role(auth.uid(), 'operativo'::app_role));

CREATE POLICY "Admins can insert cotizacion history"
ON public.supplier_cotizacion_history
FOR INSERT
WITH CHECK (has_role(auth.uid(), 'administrador'::app_role));

CREATE POLICY "Admins and operativos can insert cotizacion history"
ON public.supplier_cotizacion_history
FOR INSERT
WITH CHECK (has_role(auth.uid(), 'operativo'::app_role));

CREATE POLICY "Admins and operativos can update cotizacion history"
ON public.supplier_cotizacion_history
FOR UPDATE
USING (has_role(auth.uid(), 'administrador'::app_role) OR has_role(auth.uid(), 'operativo'::app_role));

CREATE POLICY "Admins can delete cotizacion history"
ON public.supplier_cotizacion_history
FOR DELETE
USING (has_role(auth.uid(), 'administrador'::app_role));

-- Create index for faster queries
CREATE INDEX idx_supplier_cotizacion_history_proveedor ON public.supplier_cotizacion_history(proveedor_id);
CREATE INDEX idx_supplier_cotizacion_history_fecha ON public.supplier_cotizacion_history(fecha DESC);
CREATE INDEX idx_supplier_cotizacion_history_evento ON public.supplier_cotizacion_history(evento_id);

-- Trigger for updated_at
CREATE TRIGGER update_supplier_cotizacion_history_updated_at
BEFORE UPDATE ON public.supplier_cotizacion_history
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();