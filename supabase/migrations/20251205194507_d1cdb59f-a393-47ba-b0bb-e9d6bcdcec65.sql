-- Add column for notes images
ALTER TABLE public.projects 
ADD COLUMN IF NOT EXISTS notas_imagenes JSONB DEFAULT '[]'::jsonb;

-- Create storage bucket for notes images
INSERT INTO storage.buckets (id, name, public)
VALUES ('notes-images', 'notes-images', true)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload images
CREATE POLICY "Authenticated users can upload notes images"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'notes-images');

-- Allow authenticated users to view notes images
CREATE POLICY "Anyone can view notes images"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'notes-images');

-- Allow users to delete their uploaded images
CREATE POLICY "Authenticated users can delete notes images"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'notes-images');

-- Enable realtime for the new column
ALTER TABLE public.projects REPLICA IDENTITY FULL;