-- Create audit log table for user management actions
CREATE TABLE public.user_audit_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  action TEXT NOT NULL,
  actor_id UUID NOT NULL,
  actor_email TEXT NOT NULL,
  target_id UUID,
  target_email TEXT,
  target_role TEXT,
  panel TEXT DEFAULT 'usuarios',
  details JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.user_audit_log ENABLE ROW LEVEL SECURITY;

-- Only admins can view audit logs
CREATE POLICY "Admins can view audit logs"
ON public.user_audit_log
FOR SELECT
USING (has_role(auth.uid(), 'administrador'::app_role));

-- Service role can insert (from edge functions)
CREATE POLICY "Service role can insert audit logs"
ON public.user_audit_log
FOR INSERT
WITH CHECK (true);

-- Create index for faster queries
CREATE INDEX idx_audit_log_created_at ON public.user_audit_log(created_at DESC);
CREATE INDEX idx_audit_log_action ON public.user_audit_log(action);