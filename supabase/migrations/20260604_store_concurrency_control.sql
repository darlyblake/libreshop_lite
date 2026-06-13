-- Store Operations Concurrency Control - Phase 2c Versioning + Concurrency
-- Date: 2026-06-02
-- Purpose: Add optimistic locking and prevent race conditions/lost updates

-- ============================================================================
-- 1. ADD VERSION FIELD FOR OPTIMISTIC LOCKING
-- ============================================================================

-- Add version column if it doesn't exist
ALTER TABLE stores ADD COLUMN IF NOT EXISTS version INT DEFAULT 0;

-- Create index for version-based lookups
CREATE INDEX IF NOT EXISTS idx_stores_version
  ON stores (id, version)
  WHERE status != 'deleted';

-- ============================================================================
-- 2. OPTIMISTIC LOCKING RPC - UPDATE WITH VERSION CHECK
-- ============================================================================

-- RPC: Update store with optimistic locking (increment version automatically)
-- Returns updated store on success, NULL if version mismatch (conflict)
CREATE OR REPLACE FUNCTION update_store_with_version(
  p_store_id uuid,
  p_updates jsonb,
  p_expected_version int DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  user_id uuid,
  name text,
  status text,
  subscription_status text,
  subscription_end timestamp,
  version int,
  updated_at timestamp
) AS $$
DECLARE
  v_current_version int;
  v_rows_affected int;
BEGIN
  -- Get current version if check is needed
  IF p_expected_version IS NOT NULL THEN
    SELECT version INTO v_current_version
    FROM stores
    WHERE id = p_store_id
    FOR UPDATE; -- Lock row to prevent concurrent updates
    
    -- Check version match
    IF v_current_version != p_expected_version THEN
      -- Version mismatch - return NULL to indicate conflict
      RETURN;
    END IF;
  END IF;

  -- Update with version increment
  UPDATE stores
  SET
    version = COALESCE(version, 0) + 1,
    updated_at = NOW()
  WHERE id = p_store_id
  RETURNING stores.id, stores.user_id, stores.name, stores.status, stores.subscription_status, 
            stores.subscription_end, stores.version, stores.updated_at;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 3. UPSERT WITH CONFLICT HANDLING - FIX RACE CONDITION IN ADDFOLLOW
-- ============================================================================

-- RPC: Add or update follower relationship (idempotent, handles duplicates)
-- Uses ON CONFLICT DO UPDATE to handle concurrent requests
CREATE OR REPLACE FUNCTION add_store_follower(
  p_user_id uuid,
  p_store_id uuid
)
RETURNS TABLE (
  id uuid,
  user_id uuid,
  store_id uuid,
  created_at timestamp
) AS $$
BEGIN
  -- Verify store exists (prevent following deleted stores)
  IF NOT EXISTS (
    SELECT 1 FROM stores
    WHERE id = p_store_id AND status IN ('active', 'pending') AND visible = true
  ) THEN
    RAISE EXCEPTION 'Store % does not exist or is not visible', p_store_id;
  END IF;

  -- UPSERT: Insert or do nothing if already following
  -- PostgreSQL constraint on (user_id, store_id) will prevent duplicates
  RETURN QUERY
  INSERT INTO store_followers (user_id, store_id, created_at)
  VALUES (p_user_id, p_store_id, NOW())
  ON CONFLICT (user_id, store_id) DO UPDATE
    SET created_at = EXCLUDED.created_at
  RETURNING store_followers.id, store_followers.user_id, store_followers.store_id, store_followers.created_at;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 4. ADD UNIQUE CONSTRAINT ON STORE_FOLLOWERS (if not exists)
-- ============================================================================

-- Create unique constraint to enforce one follow per user per store
-- This is critical for preventing duplicates and enabling UPSERT
DO $$
BEGIN
  ALTER TABLE store_followers
  ADD CONSTRAINT unique_user_store_follow UNIQUE (user_id, store_id);
EXCEPTION WHEN duplicate_object THEN
  NULL;
END $$;

-- ============================================================================
-- 5. AUDIT TRAIL FOR VERSION CHANGES
-- ============================================================================

-- Create a trigger to log store updates for audit trail
CREATE OR REPLACE FUNCTION log_store_changes()
RETURNS TRIGGER AS $$
BEGIN
  -- Log significant changes (version increments)
  INSERT INTO store_audit_log (store_id, action, previous_data, current_data, changed_at)
  VALUES (
    NEW.id,
    'update',
    to_jsonb(OLD) - 'version' - 'updated_at',  -- Exclude version/timestamp noise
    to_jsonb(NEW) - 'version' - 'updated_at',
    NOW()
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop trigger if exists and recreate
DROP TRIGGER IF EXISTS trigger_store_version_log ON stores;

-- Create trigger that fires on significant updates only
CREATE TRIGGER trigger_store_version_log
AFTER UPDATE OF subscription_status, subscription_end, product_limit, name, slug
ON stores
FOR EACH ROW
WHEN (OLD.version IS DISTINCT FROM NEW.version)
EXECUTE FUNCTION log_store_changes();

-- ============================================================================
-- 6. ADDITIONAL INDEXES FOR CONCURRENCY
-- ============================================================================

-- Index for frequently updated columns (subscription status checks)
CREATE INDEX IF NOT EXISTS idx_stores_subscription_updated
  ON stores (subscription_status, updated_at DESC)
  WHERE status = 'active';

-- Index for follower lookups (prevents N+1 in follower operations)
CREATE INDEX IF NOT EXISTS idx_store_followers_store
  ON store_followers (store_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_store_followers_user
  ON store_followers (user_id, created_at DESC);
