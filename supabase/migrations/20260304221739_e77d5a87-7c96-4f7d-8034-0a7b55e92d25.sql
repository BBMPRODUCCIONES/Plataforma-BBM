
-- Create aprobacion_undo_log table
CREATE TABLE public.aprobacion_undo_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid,
  item_id text NOT NULL,
  source text NOT NULL CHECK (source IN ('cajaMenor', 'gastoMenor', 'legalizacion')),
  previous_estado text NOT NULL,
  new_estado text NOT NULL,
  previous_revisado_por text DEFAULT '',
  changed_by uuid NOT NULL,
  changed_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '2 hours'),
  undone boolean NOT NULL DEFAULT false
);

-- Enable RLS
ALTER TABLE public.aprobacion_undo_log ENABLE ROW LEVEL SECURITY;

-- INSERT: any authenticated user
CREATE POLICY "Authenticated can insert undo_log"
  ON public.aprobacion_undo_log FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = changed_by);

-- SELECT: user can see their own entries
CREATE POLICY "Users can view own undo_log"
  ON public.aprobacion_undo_log FOR SELECT TO authenticated
  USING (auth.uid() = changed_by);

-- UPDATE: user can update their own entries (to mark undone)
CREATE POLICY "Users can update own undo_log"
  ON public.aprobacion_undo_log FOR UPDATE TO authenticated
  USING (auth.uid() = changed_by);

-- DELETE: admin only
CREATE POLICY "Admins can delete undo_log"
  ON public.aprobacion_undo_log FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'administrador'::app_role));
