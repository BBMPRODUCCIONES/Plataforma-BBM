
-- Add new permission columns for caja menor sub-roles
ALTER TABLE public.user_roles 
  ADD COLUMN IF NOT EXISTS es_responsable_caja_menor boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS es_auditor_caja_menor boolean DEFAULT false;

-- Add saldo_inicial and reembolsado_caja_anterior to caja_menor_config
ALTER TABLE public.caja_menor_config
  ADD COLUMN IF NOT EXISTS saldo_inicial numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS reembolsado_caja_anterior numeric NOT NULL DEFAULT 0;

-- Update caja_menor_cierres to support new review states
-- Add estado_revision column for auditor workflow
ALTER TABLE public.caja_menor_cierres
  ADD COLUMN IF NOT EXISTS estado_revision text NOT NULL DEFAULT 'En revisión';
