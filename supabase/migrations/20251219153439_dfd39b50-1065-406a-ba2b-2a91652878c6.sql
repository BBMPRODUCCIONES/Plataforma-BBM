-- Create table for global panel column configurations
CREATE TABLE public.panel_column_configs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  panel_key TEXT NOT NULL UNIQUE,
  columns JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_by UUID REFERENCES auth.users(id),
  updated_by_email TEXT
);

-- Enable RLS
ALTER TABLE public.panel_column_configs ENABLE ROW LEVEL SECURITY;

-- Everyone authenticated can read the global config
CREATE POLICY "All authenticated users can view column configs"
ON public.panel_column_configs
FOR SELECT
TO authenticated
USING (true);

-- Only admins can insert
CREATE POLICY "Admins can insert column configs"
ON public.panel_column_configs
FOR INSERT
WITH CHECK (has_role(auth.uid(), 'administrador'::app_role));

-- Only admins can update
CREATE POLICY "Admins can update column configs"
ON public.panel_column_configs
FOR UPDATE
USING (has_role(auth.uid(), 'administrador'::app_role));

-- Only admins can delete
CREATE POLICY "Admins can delete column configs"
ON public.panel_column_configs
FOR DELETE
USING (has_role(auth.uid(), 'administrador'::app_role));

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_panel_column_configs_updated_at
BEFORE UPDATE ON public.panel_column_configs
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Enable realtime for this table
ALTER PUBLICATION supabase_realtime ADD TABLE public.panel_column_configs;

-- Add comment for documentation
COMMENT ON TABLE public.panel_column_configs IS 'Global column configurations for panels - shared across all users';