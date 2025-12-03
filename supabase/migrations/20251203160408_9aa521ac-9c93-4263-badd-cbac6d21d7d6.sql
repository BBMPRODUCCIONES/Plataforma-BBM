INSERT INTO public.invitations (email, role, token, expires_at)
VALUES (
  'bbmtablet0@gmail.com',
  'administrador',
  '00000000-0000-0000-0000-000000000001',
  NOW() + INTERVAL '30 days'
);