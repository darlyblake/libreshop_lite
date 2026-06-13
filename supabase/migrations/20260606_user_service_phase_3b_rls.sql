-- User Service Phase 3b: RLS Enforcement + Versioning
-- Date: 2026-06-06
-- Purpose: Add RLS policies, grant RPC permissions, and ensure server-side enforcement

-- ============================================================================
-- 1. ENABLE RLS ON USERS TABLE
-- ============================================================================

ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 2. HELPER FUNCTION: Get current user role (SECURITY DEFINER to bypass RLS)
-- ============================================================================

DROP FUNCTION IF EXISTS get_current_user_role();
CREATE FUNCTION get_current_user_role()
RETURNS TEXT AS $$
DECLARE
  v_role TEXT;
BEGIN
  -- SECURITY DEFINER bypasses RLS on the SELECT
  SELECT role INTO v_role FROM users 
  WHERE id = auth.uid() AND is_active = true;
  RETURN COALESCE(v_role, 'user');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

GRANT EXECUTE ON FUNCTION get_current_user_role() TO authenticated, anon;

-- ============================================================================
-- 3. RLS POLICY: Users can read their own profile
-- ============================================================================

DROP POLICY IF EXISTS users_read_own_profile ON users;
CREATE POLICY users_read_own_profile ON users
  FOR SELECT
  USING (auth.uid() = id);

-- ============================================================================
-- 4. RLS POLICY: Admins can read all active profiles
-- ============================================================================

DROP POLICY IF EXISTS users_read_admin_all ON users;
CREATE POLICY users_read_admin_all ON users
  FOR SELECT
  USING (
    get_current_user_role() = 'admin'
    AND is_active = true
  );

-- ============================================================================
-- 5. RLS POLICY: Users can update their own profile
-- ============================================================================

DROP POLICY IF EXISTS users_update_own_profile ON users;
CREATE POLICY users_update_own_profile ON users
  FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (
    -- Cannot change own id or role
    auth.uid() = id
  );

-- ============================================================================
-- 6. RLS POLICY: Admins can update/delete any profile
-- ============================================================================

DROP POLICY IF EXISTS users_admin_update ON users;
CREATE POLICY users_admin_update ON users
  FOR UPDATE
  USING (get_current_user_role() = 'admin')
  WITH CHECK (get_current_user_role() = 'admin');

DROP POLICY IF EXISTS users_admin_delete ON users;
CREATE POLICY users_admin_delete ON users
  FOR DELETE
  USING (get_current_user_role() = 'admin');

-- ============================================================================
-- 7. RLS POLICY: Service inserts new users during signup
-- ============================================================================

DROP POLICY IF EXISTS users_insert_new ON users;
CREATE POLICY users_insert_new ON users
  FOR INSERT
  WITH CHECK (auth.uid() = id);

-- ============================================================================
-- 7. GRANT RPC EXECUTION PERMISSIONS
-- ============================================================================

-- Grant anon + authenticated users access to secure RPCs
GRANT EXECUTE ON FUNCTION get_user_profile_secure(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION update_user_profile_versioned(uuid, jsonb, int) TO authenticated;
GRANT EXECUTE ON FUNCTION soft_delete_user(uuid, uuid, text) TO authenticated;

-- ============================================================================
-- 8. RLS ON AUDIT LOG TABLE
-- ============================================================================

ALTER TABLE user_audit_log ENABLE ROW LEVEL SECURITY;

-- Users can read their own audit trail
DROP POLICY IF EXISTS audit_log_read_own ON user_audit_log;
CREATE POLICY audit_log_read_own ON user_audit_log
  FOR SELECT
  USING (user_id = auth.uid());

-- Admins can read all audit trails
DROP POLICY IF EXISTS audit_log_read_admin ON user_audit_log;
CREATE POLICY audit_log_read_admin ON user_audit_log
  FOR SELECT
  USING (get_current_user_role() = 'admin');

-- ============================================================================
-- 9. UTILITY FUNCTION: Get user role by ID (for non-self queries)
-- ============================================================================
-- This function can be called from application code to check any user's role

DROP FUNCTION IF EXISTS get_user_role(uuid);
CREATE FUNCTION get_user_role(p_user_id uuid)
RETURNS TEXT AS $$
DECLARE
  v_role TEXT;
BEGIN
  SELECT role INTO v_role FROM users 
  WHERE id = p_user_id AND is_active = true;
  RETURN COALESCE(v_role, 'user');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

GRANT EXECUTE ON FUNCTION get_user_role(uuid) TO authenticated, anon;
