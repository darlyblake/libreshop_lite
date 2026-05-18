-- Migration: create user_addresses table
-- Stores client delivery addresses in Supabase for cross-device access
-- Every address is tied to a Google account (user_id) and available on all devices

CREATE TABLE IF NOT EXISTS public.user_addresses (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  label TEXT NOT NULL DEFAULT 'Maison',
  city TEXT NOT NULL DEFAULT '',
  address TEXT NOT NULL DEFAULT '',
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  note TEXT,
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast lookups by user
CREATE INDEX IF NOT EXISTS idx_user_addresses_user_id ON public.user_addresses(user_id);

-- Auto-update the updated_at timestamp on row modification
CREATE OR REPLACE FUNCTION public.update_user_addresses_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_user_addresses_updated_at
  BEFORE UPDATE ON public.user_addresses
  FOR EACH ROW EXECUTE FUNCTION public.update_user_addresses_updated_at();

-- Row Level Security: each user can only access their own addresses
ALTER TABLE public.user_addresses ENABLE ROW LEVEL SECURITY;

-- SELECT: user sees only their own addresses
CREATE POLICY "user_addresses_select_own"
  ON public.user_addresses
  FOR SELECT
  USING (auth.uid() = user_id);

-- INSERT: user can only insert addresses for themselves
CREATE POLICY "user_addresses_insert_own"
  ON public.user_addresses
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- UPDATE: user can only update their own addresses
CREATE POLICY "user_addresses_update_own"
  ON public.user_addresses
  FOR UPDATE
  USING (auth.uid() = user_id);

-- DELETE: user can only delete their own addresses
CREATE POLICY "user_addresses_delete_own"
  ON public.user_addresses
  FOR DELETE
  USING (auth.uid() = user_id);
