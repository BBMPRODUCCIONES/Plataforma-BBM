
-- Allow any authenticated user to mark undo entries as undone (needed when reverting to Pendiente)
DROP POLICY IF EXISTS "Users can undo own entries within timer" ON public.aprobacion_undo_log;
CREATE POLICY "Authenticated can mark entries as undone"
ON public.aprobacion_undo_log
FOR UPDATE
TO authenticated
USING (undone = false)
WITH CHECK (undone = true);
