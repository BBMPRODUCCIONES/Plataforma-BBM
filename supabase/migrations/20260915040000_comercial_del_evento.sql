-- Comercial al que se atribuye la venta del evento.
--
-- Los campos que ya existian no servian para esto: "a cargo de" esta vacio
-- en 185 de 203 eventos, y "administrativo responsable" guarda al
-- administrativo, no al comercial, con el mismo nombre escrito de varias
-- formas. Por eso un campo propio, con valores controlados desde el codigo.
--
-- Valores esperados: 'bayron', 'abraham'. Nulo = sin asignar.

ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS comercial TEXT;

COMMENT ON COLUMN public.projects.comercial IS
  'Comercial al que se atribuye la venta. Ver src/lib/comerciales.ts. Nulo = sin asignar.';
