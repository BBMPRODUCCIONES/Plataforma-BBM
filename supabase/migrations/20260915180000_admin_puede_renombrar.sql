-- Permitir que un administrador corrija el nombre de cualquier usuario.
--
-- profiles tenia politica de lectura para administradores, pero de escritura
-- solo "Users can update their own profile". Al renombrar a otra persona, la
-- fila no pasaba el filtro y Postgres devolvia cero filas SIN error: la
-- pantalla decia "Usuario actualizado" y el nombre seguia igual.
--
-- WITH CHECK ademas de USING: sin el, un administrador podria cambiar el id de
-- la fila y sacarla de su propio alcance.
CREATE POLICY "Admins can update all profiles"
ON public.profiles
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'administrador'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'administrador'::app_role));

-- Comprobacion: deben aparecer las dos politicas de UPDATE,
-- la propia de cada usuario y esta.
SELECT policyname, cmd
FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'profiles'
ORDER BY policyname;
