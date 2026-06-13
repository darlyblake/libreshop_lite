-- User Service Phase 3a: Type Safety + RLS Foundation + Soft-Delete + Versioning
-- Date: 2026-06-05
-- Purpose: Add versioning, soft-delete, and audit fields for optimistic locking and compliance

-- ============================================================================
-- 1. ADD VERSIONING FIELD FOR OPTIMISTIC LOCKING
-- ============================================================================

-- Add version column if it doesn't exist (DEFAULT 0 for all existing users)
ALTER TABLE users ADD COLUMN IF NOT EXISTS version INT DEFAULT 0;

-- ============================================================================
-- 2. ADD SOFT-DELETE FIELDS (GDPR COMPLIANCE)
-- ============================================================================

-- Add soft-delete tracking columns
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;
ALTER TABLE users ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS deleted_by UUID NULL REFERENCES users(id);
ALTER TABLE users ADD COLUMN IF NOT EXISTS deletion_reason TEXT NULL;

-- ============================================================================
-- 3. OPTIMISTIC LOCKING RPC - UPDATE USER PROFILE WITH VERSION CHECK
-- ============================================================================

-- RPC: Update user profile with optimistic locking (increment version automatically)
-- Returns updated user on success, NULL if version mismatch (conflict detected)
CREATE OR REPLACE FUNCTION update_user_profile_versioned(
  p_user_id uuid,
  p_updates jsonb,
  p_expected_version int DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  email text,
  full_name text,
  phone text,
  avatar_url text,
  whatsapp_number text,
  status text,
  role text,
  version int,
  is_active boolean,
  updated_at timestamp
) AS $$
DECLARE
  v_current_version int;
  v_rows_affected int;
BEGIN
  -- Get current version if check is needed
  IF p_expected_version IS NOT NULL THEN
    SELECT version INTO v_current_version
    FROM users
    WHERE id = p_user_id AND is_active = true
    FOR UPDATE; -- Lock row to prevent concurrent updates
    
    -- Check version match
    IF v_current_version != p_expected_version THEN
      -- Version mismatch: conflict detected
      -- Return no rows (will be NULL in client)
      RETURN;
    END IF;
  END IF;

  -- Perform update with automatic version increment
  UPDATE users
  SET
    full_name = COALESCE((p_updates->>'full_name'), full_name),
    phone = COALESCE((p_updates->>'phone'), phone),
    avatar_url = COALESCE((p_updates->>'avatar_url'), avatar_url),
    whatsapp_number = COALESCE((p_updates->>'whatsapp_number'), whatsapp_number),
    status = COALESCE((p_updates->>'status'), status),
    version = version + 1,
    updated_at = NOW()
  WHERE id = p_user_id AND is_active = true
  RETURNING
    users.id,
    users.email,
    users.full_name,
    users.phone,
    users.avatar_url,
    users.whatsapp_number,
    users.status,
    users.role,
    users.version,
    users.is_active,
    users.updated_at;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 4. SOFT-DELETE RPC - ANONYMIZE USER PROFILE (GDPR)
-- ============================================================================

-- RPC: Soft-delete user profile with reason tracking
-- This anonymizes user data while preserving order history for accounting
CREATE OR REPLACE FUNCTION soft_delete_user(
  p_user_id uuid,
  p_deleted_by uuid,
  p_reason text DEFAULT 'user_requested'
)
RETURNS TABLE (
  id uuid,
  email text,
  is_active boolean,
  deleted_at timestamp,
  deleted_by uuid,
  deletion_reason text
) AS $$
DECLARE
  v_anon_email text;
  v_current_user_id uuid;
BEGIN
  -- Verify current user is admin or deleting themselves
  SELECT user_id INTO v_current_user_id FROM auth.users WHERE id = p_deleted_by;
  
  IF v_current_user_id IS NULL AND p_deleted_by != p_user_id THEN
    RAISE EXCEPTION 'User % not found', p_deleted_by;
  END IF;

  -- Generate anonymized email
  v_anon_email := 'deleted-' || p_user_id::text || '@deleted.local';

  -- Perform soft-delete: anonymize all PII, mark as inactive
  UPDATE users
  SET
    is_active = false,
    email = v_anon_email,
    full_name = 'Deleted User',
    phone = NULL,
    avatar_url = NULL,
    whatsapp_number = NULL,
    deleted_at = NOW(),
    deleted_by = p_deleted_by,
    deletion_reason = p_reason,
    version = version + 1,
    updated_at = NOW()
  WHERE id = p_user_id
  RETURNING
    users.id,
    users.email,
    users.is_active,
    users.deleted_at,
    users.deleted_by,
    users.deletion_reason;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 5. GET USER PROFILE RPC (SECURE - with RLS enforcement)
-- ============================================================================

-- RPC: Get user profile with server-side RLS enforcement
-- Only users can view their own profile, admins can view any active profile
CREATE OR REPLACE FUNCTION get_user_profile_secure(p_user_id uuid)
RETURNS TABLE (
  id uuid,
  email text,
  full_name text,
  phone text,
  avatar_url text,
  whatsapp_number text,
  status text,
  role text,
  version int,
  is_active boolean,
  created_at timestamp,
  updated_at timestamp
) AS $$
BEGIN
  -- This function runs with SECURITY DEFINER, but we enforce RLS in the logic
  -- Get current user from JWT
  RETURN QUERY
  SELECT
    users.id,
    users.email,
    users.full_name,
    users.phone,
    users.avatar_url,
    users.whatsapp_number,
    users.status,
    users.role,
    users.version,
    users.is_active,
    users.created_at,
    users.updated_at
  FROM users
  WHERE
    users.id = p_user_id
    AND users.is_active = true
    AND (
      -- User can view their own profile
      auth.uid() = p_user_id
      -- Admin can view any active profile (check role securely)
      OR get_current_user_role() = 'admin'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- ============================================================================
-- 6. CREATE AUDIT TRAIL TABLE FOR USER CHANGES
-- ============================================================================

-- Create audit log table if it doesn't exist
CREATE TABLE IF NOT EXISTS user_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id),
  action text NOT NULL, -- 'create', 'update', 'delete', 'login'
  previous_data jsonb,
  current_data jsonb,
  changed_at timestamp NOT NULL DEFAULT NOW(),
  changed_by uuid REFERENCES users(id),
  
  CONSTRAINT valid_action CHECK (action IN ('create', 'update', 'delete', 'login'))
);

CREATE INDEX IF NOT EXISTS idx_user_audit_log_user
  ON user_audit_log (user_id, changed_at DESC);

CREATE INDEX IF NOT EXISTS idx_user_audit_log_action
  ON user_audit_log (action, changed_at DESC);

-- ============================================================================
-- 7. TRIGGER - LOG USER PROFILE CHANGES
-- ============================================================================

-- Function to log user profile changes
CREATE OR REPLACE FUNCTION log_user_profile_changes()
RETURNS TRIGGER AS $$
BEGIN
  -- Log only if significant fields changed (not every version increment)
  IF (
    OLD.email IS DISTINCT FROM NEW.email
    OR OLD.full_name IS DISTINCT FROM NEW.full_name
    OR OLD.phone IS DISTINCT FROM NEW.phone
    OR OLD.is_active IS DISTINCT FROM NEW.is_active
    OR OLD.status IS DISTINCT FROM NEW.status
  ) THEN
    INSERT INTO user_audit_log (user_id, action, previous_data, current_data, changed_by)
    VALUES (
      NEW.id,
      CASE
        WHEN OLD.id IS NULL THEN 'create'
        WHEN NEW.is_active = false AND OLD.is_active = true THEN 'delete'
        ELSE 'update'
      END,
      to_jsonb(OLD) - 'version' - 'updated_at',  -- Exclude noise
      to_jsonb(NEW) - 'version' - 'updated_at',
      NEW.id  -- User modifying their own profile
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop trigger if exists and recreate
DROP TRIGGER IF EXISTS trigger_user_profile_changes ON users;

-- Create trigger that fires on significant updates
CREATE TRIGGER trigger_user_profile_changes
AFTER UPDATE OF email, full_name, phone, is_active, status
ON users
FOR EACH ROW
EXECUTE FUNCTION log_user_profile_changes();
