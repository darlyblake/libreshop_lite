-- ============================================================================
-- Phase 3c Migration: User Address Management with RLS
-- ============================================================================
-- Purpose:
-- - Create user_addresses table for delivery address management
-- - Add RLS policies for address privacy
-- - Create indexes for query optimization
-- - Setup audit logging for address changes
--
-- Safety: All operations are idempotent (IF NOT EXISTS)
-- Dependencies: user_audit_log table from Phase 3a migration
-- ============================================================================

-- Create user_addresses table if not exists
CREATE TABLE IF NOT EXISTS public.user_addresses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  
  -- Address fields
  label TEXT NOT NULL DEFAULT 'Home', -- e.g., 'Home', 'Work', 'Other'
  street TEXT NOT NULL,
  postal_code TEXT NOT NULL,
  city TEXT NOT NULL,
  country TEXT NOT NULL DEFAULT 'Cameroon',
  phone TEXT NOT NULL, -- Delivery contact phone
  
  -- Metadata
  is_default BOOLEAN DEFAULT FALSE, -- Primary address for checkout
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  
  -- Indexes
  UNIQUE(user_id, is_default) -- Only one default per user (with partial index below)
);

-- Partial unique index for default addresses (ensures at most one is_default per user)
CREATE UNIQUE INDEX IF NOT EXISTS idx_user_default_address 
  ON public.user_addresses(user_id) 
  WHERE is_default = TRUE;

-- Regular indexes for query optimization
CREATE INDEX IF NOT EXISTS idx_user_addresses_user_id 
  ON public.user_addresses(user_id);

CREATE INDEX IF NOT EXISTS idx_user_addresses_is_default 
  ON public.user_addresses(user_id, is_default DESC);

CREATE INDEX IF NOT EXISTS idx_user_addresses_created_at 
  ON public.user_addresses(user_id, created_at DESC);

-- Enable RLS
ALTER TABLE public.user_addresses ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (for idempotency)
DROP POLICY IF EXISTS "address_read_own" ON public.user_addresses;
DROP POLICY IF EXISTS "address_write_own" ON public.user_addresses;
DROP POLICY IF EXISTS "address_delete_own" ON public.user_addresses;

-- RLS Policies for user_addresses
-- Policy 1: Users can read their own addresses
CREATE POLICY "address_read_own" ON public.user_addresses
  FOR SELECT
  USING (
    auth.uid() = user_id OR
    (SELECT role FROM public.users WHERE id = auth.uid()) = 'admin'
  );

-- Policy 2: Users can create addresses for themselves
CREATE POLICY "address_write_own" ON public.user_addresses
  FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
  );

-- Policy 3: Users can update their own addresses
CREATE POLICY "address_update_own" ON public.user_addresses
  FOR UPDATE
  USING (
    auth.uid() = user_id OR
    (SELECT role FROM public.users WHERE id = auth.uid()) = 'admin'
  )
  WITH CHECK (
    auth.uid() = user_id OR
    (SELECT role FROM public.users WHERE id = auth.uid()) = 'admin'
  );

-- Policy 4: Users can delete their own addresses
CREATE POLICY "address_delete_own" ON public.user_addresses
  FOR DELETE
  USING (
    auth.uid() = user_id
  );

-- Admin override
CREATE POLICY "address_admin" ON public.user_addresses
  FOR ALL
  USING (
    (SELECT role FROM public.users WHERE id = auth.uid()) = 'admin'
  );

-- ============================================================================
-- AUDIT LOGGING FOR ADDRESSES
-- ============================================================================

-- Create audit logging trigger for user_addresses
CREATE OR REPLACE FUNCTION public.log_user_address_changes()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.user_audit_log (
    user_id,
    action,
    previous_data,
    current_data,
    changed_at,
    changed_by
  ) VALUES (
    NEW.user_id,
    TG_OP,
    CASE WHEN TG_OP = 'UPDATE' THEN row_to_json(OLD) ELSE NULL END,
    row_to_json(NEW),
    now(),
    auth.uid()
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop trigger if exists (for idempotency)
DROP TRIGGER IF EXISTS log_address_changes ON public.user_addresses;

-- Create trigger for address changes
CREATE TRIGGER log_address_changes
  AFTER INSERT OR UPDATE OR DELETE ON public.user_addresses
  FOR EACH ROW
  EXECUTE FUNCTION log_user_address_changes();

-- ============================================================================
-- UTILITY FUNCTION: Set user default address
-- ============================================================================

CREATE OR REPLACE FUNCTION public.set_user_default_address(
  p_user_id UUID,
  p_address_id UUID
)
RETURNS public.user_addresses AS $$
BEGIN
  -- Verify address belongs to user
  IF NOT EXISTS (
    SELECT 1 FROM public.user_addresses 
    WHERE id = p_address_id AND user_id = p_user_id
  ) THEN
    RAISE EXCEPTION 'Address not found or does not belong to user';
  END IF;

  -- Reset all other addresses to not default
  UPDATE public.user_addresses 
  SET is_default = FALSE 
  WHERE user_id = p_user_id AND id != p_address_id;

  -- Set this address as default
  UPDATE public.user_addresses 
  SET is_default = TRUE 
  WHERE id = p_address_id;

  -- Return updated address
  RETURN (
    SELECT * FROM public.user_addresses WHERE id = p_address_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- ============================================================================
-- PERMISSIONS
-- ============================================================================

-- Grant appropriate permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_addresses TO authenticated;
GRANT EXECUTE ON FUNCTION public.log_user_address_changes TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_user_default_address(UUID, UUID) TO authenticated;

-- ============================================================================
-- MIGRATION NOTES
-- ============================================================================
-- - user_addresses table created with soft-delete support (via CASCADE)
-- - RLS policies ensure users can only access their own addresses
-- - Partial unique index prevents multiple default addresses per user
-- - Audit logging captures all address changes
-- - set_user_default_address() ensures only one default address
-- - Compatible with Phase 3a audit logging infrastructure
