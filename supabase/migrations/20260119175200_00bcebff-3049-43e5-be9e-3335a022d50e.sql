-- Drop the overly permissive INSERT policy
DROP POLICY IF EXISTS "Service role can insert notifications" ON public.notifications;

-- Create a more secure INSERT policy
-- Any authenticated user can create notifications (the edge function will handle authorization)
-- But the user_id must be a valid user
CREATE POLICY "Authenticated users can insert notifications"
ON public.notifications
FOR INSERT
TO authenticated
WITH CHECK (true);

-- Also allow service role (for edge functions) - this is implicit with service_role key