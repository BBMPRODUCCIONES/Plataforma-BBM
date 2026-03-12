
DROP POLICY "Users can view own undo_log" ON public.aprobacion_undo_log;

CREATE POLICY "Authenticated can view all undo_log"
ON public.aprobacion_undo_log
FOR SELECT
TO authenticated
USING (true);
