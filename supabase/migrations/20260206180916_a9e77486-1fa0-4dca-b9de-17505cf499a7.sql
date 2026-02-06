-- Add certificado_bancario column to suppliers table for storing bank certificate images
ALTER TABLE public.suppliers ADD COLUMN IF NOT EXISTS certificado_bancario text DEFAULT '';

-- Create storage bucket for supplier bank certificates
INSERT INTO storage.buckets (id, name, public)
VALUES ('supplier-certificates', 'supplier-certificates', true)
ON CONFLICT (id) DO NOTHING;

-- Create RLS policies for storage bucket
CREATE POLICY "Authenticated users can view supplier certificates"
ON storage.objects FOR SELECT
USING (bucket_id = 'supplier-certificates');

CREATE POLICY "Admins and operativos can upload supplier certificates"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'supplier-certificates' 
  AND (
    public.has_role(auth.uid(), 'administrador'::public.app_role) 
    OR public.has_role(auth.uid(), 'operativo'::public.app_role)
  )
);

CREATE POLICY "Admins and operativos can update supplier certificates"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'supplier-certificates' 
  AND (
    public.has_role(auth.uid(), 'administrador'::public.app_role) 
    OR public.has_role(auth.uid(), 'operativo'::public.app_role)
  )
);

CREATE POLICY "Admins can delete supplier certificates"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'supplier-certificates' 
  AND public.has_role(auth.uid(), 'administrador'::public.app_role)
);