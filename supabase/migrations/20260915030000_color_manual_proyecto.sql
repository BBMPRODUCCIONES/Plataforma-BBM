-- Color manual de la fila, puesto a mano desde el Panel Directivo.
-- Sirve para marcar los eventos que ya estaban cargados antes de que
-- existiera el color por autor, o para cualquier clasificacion propia.
--
-- Se guarda el color en hexadecimal, por ejemplo #22c55e. Nulo = sin color.

ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS color TEXT;

COMMENT ON COLUMN public.projects.color IS
  'Color manual de la fila en hexadecimal. Lo asigna el Panel Directivo. Nulo = sin color.';
