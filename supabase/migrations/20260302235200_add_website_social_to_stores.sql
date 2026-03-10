-- Add missing columns used by the app when creating a store
ALTER TABLE IF EXISTS public.stores
  ADD COLUMN IF NOT EXISTS website text,
  ADD COLUMN IF NOT EXISTS social jsonb DEFAULT '{}'::jsonb;
