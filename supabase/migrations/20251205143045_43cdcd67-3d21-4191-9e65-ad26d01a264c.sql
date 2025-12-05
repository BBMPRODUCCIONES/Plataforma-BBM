-- Enable REPLICA IDENTITY FULL for all tables to capture complete row data during updates
ALTER TABLE public.projects REPLICA IDENTITY FULL;
ALTER TABLE public.employees REPLICA IDENTITY FULL;
ALTER TABLE public.clients REPLICA IDENTITY FULL;
ALTER TABLE public.suppliers REPLICA IDENTITY FULL;