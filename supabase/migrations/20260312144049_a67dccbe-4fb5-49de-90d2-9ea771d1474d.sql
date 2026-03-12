
-- Remove the DELETE policy so nobody can delete undo log entries
DROP POLICY IF EXISTS "Admins can delete undo_log" ON public.aprobacion_undo_log;

-- Restrict UPDATE: only the person who made the change can mark it as undone,
-- and only while the timer hasn't expired yet
DROP POLICY IF EXISTS "Users can update own undo_log" ON public.aprobacion_undo_log;
CREATE POLICY "Users can undo own entries within timer"
ON public.aprobacion_undo_log
FOR UPDATE
TO authenticated
USING (
  auth.uid() = changed_by
  AND undone = false
  AND expires_at > now()
)
WITH CHECK (
  undone = true
);
