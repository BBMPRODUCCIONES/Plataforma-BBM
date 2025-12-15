-- Insert audit log entries for detected orphaned users (exist in auth.users but not in user_roles)
-- These users were detected via SQL query on 2025-12-15

INSERT INTO public.user_audit_log (action, actor_id, actor_email, target_email, target_id, panel, details)
VALUES 
  ('INCOMPLETE_DELETION_DETECTED', '00000000-0000-0000-0000-000000000000', 'sistema', 'bbmtablet0@gmail.com', '83c22cf2-aced-4287-b11a-cb7713d077c2', 'usuarios', '{"reason": "Usuario detectado en auth.users sin registro en user_roles (eliminación incompleta)", "detected_at": "2025-12-15", "full_name": "Administrador BBM"}'),
  ('INCOMPLETE_DELETION_DETECTED', '00000000-0000-0000-0000-000000000000', 'sistema', 'diegomejiaz2001@gmail.com', '7853ab4a-0ff5-4b71-be3f-24ea0fd0ad56', 'usuarios', '{"reason": "Usuario detectado en auth.users sin registro en user_roles (eliminación incompleta)", "detected_at": "2025-12-15", "full_name": "diegomejiaz2001"}'),
  ('INCOMPLETE_DELETION_DETECTED', '00000000-0000-0000-0000-000000000000', 'sistema', 'nicol.salleg@gmail.com', '3a64f6ad-d8c5-4c32-9c3e-3f6def73d49a', 'usuarios', '{"reason": "Usuario detectado en auth.users sin registro en user_roles (eliminación incompleta)", "detected_at": "2025-12-15", "full_name": "nicol.salleg"}'),
  ('INCOMPLETE_DELETION_DETECTED', '00000000-0000-0000-0000-000000000000', 'sistema', 'yiself.jimenezb@gmail.com', '7c08116a-a1e3-44fa-96a8-4d9a04a0e0df', 'usuarios', '{"reason": "Usuario detectado en auth.users sin registro en user_roles (eliminación incompleta)", "detected_at": "2025-12-15", "full_name": "yiself.jimenezb"}'),
  ('INCOMPLETE_DELETION_DETECTED', '00000000-0000-0000-0000-000000000000', 'sistema', 'dani.vallejo@bbm.com.co', '7b0fc81b-1d23-402f-bcc4-acfa06f8bca1', 'usuarios', '{"reason": "Usuario detectado en auth.users sin registro en user_roles (eliminación incompleta)", "detected_at": "2025-12-15", "full_name": "Dani Vallejo"}')
ON CONFLICT DO NOTHING;