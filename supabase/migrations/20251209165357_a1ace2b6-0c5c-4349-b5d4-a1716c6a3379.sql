
-- Add email column to user_roles table
ALTER TABLE public.user_roles 
ADD COLUMN email text;

-- Populate existing emails by matching profiles with invitations based on timestamps
-- User 1: DIANA HINCAPIE - comercialbbmprodcciones@gmail.com
UPDATE public.user_roles 
SET email = 'comercialbbmprodcciones@gmail.com' 
WHERE user_id = '0a511fe3-17d4-4987-89d0-7678937d1ffa';

-- User 2: Jhorman David - jhorman.herreno.bbm@gmail.com
UPDATE public.user_roles 
SET email = 'jhorman.herreno.bbm@gmail.com' 
WHERE user_id = '1d89a7e7-4af5-42b5-b0df-bb078c910211';

-- User 3: KAREN VIVIANA BOCANEGRA - administrativo@bbmproducciones.com.co
UPDATE public.user_roles 
SET email = 'administrativo@bbmproducciones.com.co' 
WHERE user_id = 'ef765bc9-e275-4b8d-9f5b-f12a657aa263';

-- User 4: DIANA OPERATIVA - stratego.adquisicion@gmail.com
UPDATE public.user_roles 
SET email = 'stratego.adquisicion@gmail.com' 
WHERE user_id = '974a72de-4017-4aac-8dad-064d4454f5ec';

-- User 5: diana prueba 2 - comercial02.bbm@gmail.com
UPDATE public.user_roles 
SET email = 'comercial02.bbm@gmail.com' 
WHERE user_id = '7829af66-bc91-4ae4-a97f-08c0aa8f311a';

-- User 6: Administrador BBM - bbmtablet0@gmail.com
UPDATE public.user_roles 
SET email = 'bbmtablet0@gmail.com' 
WHERE user_id = '83c22cf2-aced-4287-b11a-cb7713d077c2';
