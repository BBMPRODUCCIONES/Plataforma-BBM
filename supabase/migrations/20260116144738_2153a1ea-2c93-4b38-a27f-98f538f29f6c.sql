-- Add desmontaje date/time fields to projects table
ALTER TABLE public.projects 
ADD COLUMN fecha_desmontaje_inicio text NOT NULL DEFAULT '',
ADD COLUMN fecha_desmontaje_fin text NOT NULL DEFAULT '',
ADD COLUMN hora_desmontaje_inicio text NOT NULL DEFAULT '18:00',
ADD COLUMN hora_desmontaje_fin text NOT NULL DEFAULT '22:00';