-- Add soft delete columns to projects table
ALTER TABLE public.projects 
ADD COLUMN IF NOT EXISTS is_deleted boolean NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS deleted_at timestamp with time zone,
ADD COLUMN IF NOT EXISTS deleted_by uuid,
ADD COLUMN IF NOT EXISTS deleted_by_email text;

-- Create index for filtering deleted/active projects
CREATE INDEX IF NOT EXISTS idx_projects_is_deleted ON public.projects(is_deleted);