-- Que cualquier usuario autenticado pueda leer la lista de nombres.
--
-- Hace falta para el selector de "Productor" del Panel Directivo: hasta ahora
-- solo los administradores podian leer profiles, asi que a cualquier otro el
-- desplegable le habria salido vacio, sin explicacion.
--
-- Lo que se abre son nombres de companeros dentro de una herramienta interna.
-- profiles solo tiene id, full_name y created_at: no hay correos, ni roles, ni
-- permisos. Los roles siguen cerrados a administradores en user_roles.
CREATE POLICY "Authenticated users can read profile names"
ON public.profiles
FOR SELECT
TO authenticated
USING (true);

-- Comprobacion: deben quedar las politicas de SELECT propias, la de
-- administrador y esta.
SELECT policyname, cmd
FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'profiles'
ORDER BY cmd, policyname;
