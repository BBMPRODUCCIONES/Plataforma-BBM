ALTER TABLE public.gastos_menores ADD COLUMN restaurada_por text DEFAULT NULL;
ALTER TABLE public.gastos_menores ADD COLUMN restaurada_en timestamptz DEFAULT NULL;