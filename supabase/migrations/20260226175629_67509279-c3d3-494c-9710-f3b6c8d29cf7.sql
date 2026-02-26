
-- Step 1: Add new columns to gastos_menores
ALTER TABLE public.gastos_menores 
  ADD COLUMN IF NOT EXISTS nombre_comercio text DEFAULT '',
  ADD COLUMN IF NOT EXISTS nit_cc text DEFAULT '',
  ADD COLUMN IF NOT EXISTS tipo_centro text DEFAULT 'eventos';

-- Step 2: Create caja_menor_config table
CREATE TABLE IF NOT EXISTS public.caja_menor_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  base_asignada numeric NOT NULL DEFAULT 0,
  responsable_user_id uuid,
  responsable_nombre text DEFAULT '',
  responsable_timestamp timestamptz,
  estado_cierre text NOT NULL DEFAULT 'Abierta',
  desembolso numeric NOT NULL DEFAULT 0,
  desembolsado_por text DEFAULT '',
  fecha_cierre timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS on caja_menor_config
ALTER TABLE public.caja_menor_config ENABLE ROW LEVEL SECURITY;

-- RLS policies for caja_menor_config
CREATE POLICY "All authenticated can view caja_menor_config"
  ON public.caja_menor_config FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can insert caja_menor_config"
  ON public.caja_menor_config FOR INSERT
  TO authenticated
  WITH CHECK (has_role(auth.uid(), 'administrador'::app_role));

CREATE POLICY "Admins can update caja_menor_config"
  ON public.caja_menor_config FOR UPDATE
  TO authenticated
  USING (has_role(auth.uid(), 'administrador'::app_role));

CREATE POLICY "Admins can delete caja_menor_config"
  ON public.caja_menor_config FOR DELETE
  TO authenticated
  USING (has_role(auth.uid(), 'administrador'::app_role));

-- Step 3: Create caja_menor_cierres table
CREATE TABLE IF NOT EXISTS public.caja_menor_cierres (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fecha_cierre timestamptz NOT NULL DEFAULT now(),
  responsable_nombre text NOT NULL DEFAULT '',
  responsable_user_id uuid,
  valor_total numeric NOT NULL DEFAULT 0,
  estado text NOT NULL DEFAULT 'Legalizado',
  desembolsado_por text DEFAULT '',
  cambios_base text DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS on caja_menor_cierres
ALTER TABLE public.caja_menor_cierres ENABLE ROW LEVEL SECURITY;

-- RLS policies for caja_menor_cierres
CREATE POLICY "All authenticated can view caja_menor_cierres"
  ON public.caja_menor_cierres FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can insert caja_menor_cierres"
  ON public.caja_menor_cierres FOR INSERT
  TO authenticated
  WITH CHECK (has_role(auth.uid(), 'administrador'::app_role));

CREATE POLICY "Admins can update caja_menor_cierres"
  ON public.caja_menor_cierres FOR UPDATE
  TO authenticated
  USING (has_role(auth.uid(), 'administrador'::app_role));

CREATE POLICY "Admins can delete caja_menor_cierres"
  ON public.caja_menor_cierres FOR DELETE
  TO authenticated
  USING (has_role(auth.uid(), 'administrador'::app_role));

-- Enable realtime for both new tables
ALTER PUBLICATION supabase_realtime ADD TABLE public.caja_menor_config;
ALTER PUBLICATION supabase_realtime ADD TABLE public.caja_menor_cierres;
