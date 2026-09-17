-- Comentarios del evento: lo que el equipo se dice sobre un evento concreto.
--
-- Va en tabla propia y no en una columna jsonb de projects, como si se hizo con
-- costos y bodega, por una razon que aqui si pesa: los comentarios los escriben
-- varias personas al tiempo. Con un arreglo jsonb, dos comentarios simultaneos
-- se pisan (cada quien guarda el arreglo que leyo y el ultimo gana), y uno de
-- los dos se pierde sin que nadie se entere. Una fila por comentario no tiene
-- ese problema.
--
-- El nombre del autor se guarda junto al comentario, ademas del id. Es
-- redundante a proposito: si manana se borra el usuario, el comentario debe
-- seguir diciendo quien lo escribio en vez de quedar huerfano.
CREATE TABLE IF NOT EXISTS public.project_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  autor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  autor_nombre text NOT NULL,
  texto text NOT NULL CHECK (length(trim(texto)) > 0),
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.project_comments IS
  'Comentarios del equipo sobre un evento. Una fila por comentario para que dos personas puedan escribir al tiempo sin pisarse.';
COMMENT ON COLUMN public.project_comments.autor_nombre IS
  'Nombre del autor al momento de escribir. Se guarda aparte del id para que el comentario no quede huerfano si el usuario se borra.';

-- Leer y escribir se hace siempre por project_id y en orden: sin este indice
-- cada apertura de la ficha recorreria la tabla entera.
CREATE INDEX IF NOT EXISTS project_comments_por_evento
  ON public.project_comments (project_id, created_at DESC);

ALTER TABLE public.project_comments ENABLE ROW LEVEL SECURITY;

-- Cualquiera que entre a la plataforma lee los comentarios: son de un equipo
-- que trabaja sobre el mismo evento, y esconderselos a la mitad no tendria
-- sentido.
DROP POLICY IF EXISTS "Autenticados leen comentarios" ON public.project_comments;
CREATE POLICY "Autenticados leen comentarios"
ON public.project_comments
FOR SELECT
TO authenticated
USING (true);

-- Escribir tambien lo puede hacer cualquiera, pero solo a nombre propio: la
-- condicion sobre autor_id impide firmar un comentario como si fuera de otro.
DROP POLICY IF EXISTS "Autenticados comentan a nombre propio" ON public.project_comments;
CREATE POLICY "Autenticados comentan a nombre propio"
ON public.project_comments
FOR INSERT
TO authenticated
WITH CHECK (autor_id = auth.uid());

-- Editar el comentario de otro cambiaria lo que esa persona dijo. Solo el autor
-- corrige lo suyo.
DROP POLICY IF EXISTS "Cada quien edita su comentario" ON public.project_comments;
CREATE POLICY "Cada quien edita su comentario"
ON public.project_comments
FOR UPDATE
TO authenticated
USING (autor_id = auth.uid())
WITH CHECK (autor_id = auth.uid());

-- Borrar: el autor, o un administrador que tenga que quitar algo indebido.
DROP POLICY IF EXISTS "Borra el autor o un administrador" ON public.project_comments;
CREATE POLICY "Borra el autor o un administrador"
ON public.project_comments
FOR DELETE
TO authenticated
USING (
  autor_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM public.user_roles r
    WHERE r.user_id = auth.uid() AND r.role::text = 'administrador'
  )
);

-- Comprobacion: deben quedar las cuatro politicas.
SELECT policyname, cmd
FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'project_comments'
ORDER BY cmd, policyname;
