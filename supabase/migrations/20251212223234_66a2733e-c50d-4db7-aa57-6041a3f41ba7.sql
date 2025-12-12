-- Add contingency exit fields to horarios table
ALTER TABLE public.horarios 
ADD COLUMN IF NOT EXISTS contingencia_foto TEXT DEFAULT NULL,
ADD COLUMN IF NOT EXISTS contingencia_hora TEXT DEFAULT NULL,
ADD COLUMN IF NOT EXISTS contingencia_ubicacion TEXT DEFAULT NULL,
ADD COLUMN IF NOT EXISTS contingencia_lat NUMERIC DEFAULT NULL,
ADD COLUMN IF NOT EXISTS contingencia_lng NUMERIC DEFAULT NULL,
ADD COLUMN IF NOT EXISTS contingencia_accuracy_m NUMERIC DEFAULT NULL,
ADD COLUMN IF NOT EXISTS contingencia_maps_url TEXT DEFAULT NULL,
ADD COLUMN IF NOT EXISTS contingencia_location_status TEXT DEFAULT NULL,
ADD COLUMN IF NOT EXISTS contingencia_contexto JSONB DEFAULT NULL;