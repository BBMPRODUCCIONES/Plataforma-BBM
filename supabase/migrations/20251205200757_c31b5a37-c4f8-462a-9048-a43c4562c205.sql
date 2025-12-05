-- Create storage bucket for project attachments
INSERT INTO storage.buckets (id, name, public)
VALUES ('project-attachments', 'project-attachments', false)
ON CONFLICT (id) DO NOTHING;

-- RLS policies for project-attachments bucket
-- Allow authenticated users to upload files
CREATE POLICY "Authenticated users can upload project attachments"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'project-attachments');

-- Allow authenticated users to view files
CREATE POLICY "Authenticated users can view project attachments"
ON storage.objects
FOR SELECT
TO authenticated
USING (bucket_id = 'project-attachments');

-- Allow authenticated users to delete their files
CREATE POLICY "Authenticated users can delete project attachments"
ON storage.objects
FOR DELETE
TO authenticated
USING (bucket_id = 'project-attachments');

-- Allow authenticated users to update files
CREATE POLICY "Authenticated users can update project attachments"
ON storage.objects
FOR UPDATE
TO authenticated
USING (bucket_id = 'project-attachments');