-- Enable realtime updates for horarios so Operaciones writes are immediately visible in Empleados → Gestión de Horarios

-- Ensure full row data is available for UPDATE events
ALTER TABLE public.horarios REPLICA IDENTITY FULL;

-- Add horarios to realtime publication (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'horarios'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.horarios;
  END IF;
END $$;
