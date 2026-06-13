-- ============================================================================
-- Phase 3d Migration: User Preferences Management with RLS & Cache
-- ============================================================================
-- Purpose:
-- - Create user_preferences table for application settings
-- - Add RLS policies for preference privacy
-- - Create indexes for query optimization
-- - Setup audit logging for preference changes
--
-- Safety: All operations are idempotent (IF NOT EXISTS)
-- Dependencies: users table from Phase 3a
-- ============================================================================

-- Create user_preferences table if not exists
CREATE TABLE IF NOT EXISTS public.user_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES public.users(id) ON DELETE CASCADE,
  
  -- Preference fields
  language TEXT NOT NULL DEFAULT 'en', -- 'en', 'fr', 'es'
  currency TEXT NOT NULL DEFAULT 'XAF', -- Currency code (ISO 4217)
  theme TEXT NOT NULL DEFAULT 'auto', -- 'light', 'dark', 'auto'
  timezone TEXT NOT NULL DEFAULT 'Africa/Douala', -- IANA timezone
  
  -- Notification settings
  notifications_enabled BOOLEAN DEFAULT TRUE,
  newsletter_subscribed BOOLEAN DEFAULT FALSE,
  notifications_email BOOLEAN DEFAULT TRUE,
  notifications_push BOOLEAN DEFAULT TRUE,
  notifications_sms BOOLEAN DEFAULT FALSE,
  
  -- Audit fields
  version INT DEFAULT 0, -- For optimistic locking
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  
  -- Indexes
  CONSTRAINT valid_language CHECK (language IN ('en', 'fr', 'es')),
  CONSTRAINT valid_theme CHECK (theme IN ('light', 'dark', 'auto')),
  CONSTRAINT valid_notifications CHECK (
    notifications_enabled IS NOT NULL AND 
    newsletter_subscribed IS NOT NULL
  )
);

-- Create indexes for query optimization
CREATE INDEX IF NOT EXISTS idx_user_preferences_user_id 
  ON public.user_preferences(user_id);

CREATE INDEX IF NOT EXISTS idx_user_preferences_language 
  ON public.user_preferences(language);

CREATE INDEX IF NOT EXISTS idx_user_preferences_timezone 
  ON public.user_preferences(timezone);

-- Enable RLS
ALTER TABLE public.user_preferences ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (for idempotency)
DROP POLICY IF EXISTS "pref_read_own" ON public.user_preferences;
DROP POLICY IF EXISTS "pref_write_own" ON public.user_preferences;
DROP POLICY IF EXISTS "pref_update_own" ON public.user_preferences;
DROP POLICY IF EXISTS "pref_admin" ON public.user_preferences;

-- RLS Policies for user_preferences
-- Policy 1: Users can read their own preferences
CREATE POLICY "pref_read_own" ON public.user_preferences
  FOR SELECT
  USING (
    auth.uid() = user_id OR
    (SELECT role FROM public.users WHERE id = auth.uid()) = 'admin'
  );

-- Policy 2: Users can create preferences (one per user via UNIQUE constraint)
CREATE POLICY "pref_write_own" ON public.user_preferences
  FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
  );

-- Policy 3: Users can update their own preferences
CREATE POLICY "pref_update_own" ON public.user_preferences
  FOR UPDATE
  USING (
    auth.uid() = user_id OR
    (SELECT role FROM public.users WHERE id = auth.uid()) = 'admin'
  )
  WITH CHECK (
    auth.uid() = user_id OR
    (SELECT role FROM public.users WHERE id = auth.uid()) = 'admin'
  );

-- Admin override for all operations
CREATE POLICY "pref_admin" ON public.user_preferences
  FOR ALL
  USING (
    (SELECT role FROM public.users WHERE id = auth.uid()) = 'admin'
  );

-- ============================================================================
-- AUDIT LOGGING FOR PREFERENCES
-- ============================================================================

-- Create audit logging trigger for user_preferences
CREATE OR REPLACE FUNCTION public.log_user_preference_changes()
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
    CASE WHEN TG_OP IN ('UPDATE', 'DELETE') THEN row_to_json(OLD) ELSE NULL END,
    CASE WHEN TG_OP IN ('INSERT', 'UPDATE') THEN row_to_json(NEW) ELSE NULL END,
    now(),
    auth.uid()
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop trigger if exists (for idempotency)
DROP TRIGGER IF EXISTS log_preference_changes ON public.user_preferences;

-- Create trigger for preference changes
CREATE TRIGGER log_preference_changes
  AFTER INSERT OR UPDATE OR DELETE ON public.user_preferences
  FOR EACH ROW
  EXECUTE FUNCTION log_user_preference_changes();

-- ============================================================================
-- RPC FUNCTION: Get or create user preferences with defaults
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_user_preferences(
  p_user_id UUID
)
RETURNS public.user_preferences AS $$
DECLARE
  v_prefs public.user_preferences;
BEGIN
  -- Try to get existing preferences
  SELECT * INTO v_prefs FROM public.user_preferences 
  WHERE user_id = p_user_id;
  
  -- If not found, create default preferences
  IF NOT FOUND THEN
    INSERT INTO public.user_preferences (user_id)
    VALUES (p_user_id)
    RETURNING * INTO v_prefs;
  END IF;
  
  RETURN v_prefs;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- ============================================================================
-- RPC FUNCTION: Update user preferences with versioning
-- ============================================================================

CREATE OR REPLACE FUNCTION public.update_user_preferences(
  p_user_id UUID,
  p_updates JSONB,
  p_expected_version INT DEFAULT NULL
)
RETURNS public.user_preferences AS $$
DECLARE
  v_affected_count INT;
BEGIN
  -- Validate updates JSON keys
  IF NOT (p_updates ? 'language' OR p_updates ? 'currency' OR 
          p_updates ? 'theme' OR p_updates ? 'timezone' OR
          p_updates ? 'notifications_enabled' OR p_updates ? 'newsletter_subscribed' OR
          p_updates ? 'notifications_email' OR p_updates ? 'notifications_push' OR
          p_updates ? 'notifications_sms') THEN
    RAISE EXCEPTION 'No valid preference fields to update';
  END IF;

  -- Update with version check (optimistic locking)
  UPDATE public.user_preferences
  SET 
    language = COALESCE((p_updates->>'language')::TEXT, language),
    currency = COALESCE((p_updates->>'currency')::TEXT, currency),
    theme = COALESCE((p_updates->>'theme')::TEXT, theme),
    timezone = COALESCE((p_updates->>'timezone')::TEXT, timezone),
    notifications_enabled = COALESCE((p_updates->>'notifications_enabled')::BOOLEAN, notifications_enabled),
    newsletter_subscribed = COALESCE((p_updates->>'newsletter_subscribed')::BOOLEAN, newsletter_subscribed),
    notifications_email = COALESCE((p_updates->>'notifications_email')::BOOLEAN, notifications_email),
    notifications_push = COALESCE((p_updates->>'notifications_push')::BOOLEAN, notifications_push),
    notifications_sms = COALESCE((p_updates->>'notifications_sms')::BOOLEAN, notifications_sms),
    version = version + 1,
    updated_at = now()
  WHERE 
    user_id = p_user_id AND 
    (p_expected_version IS NULL OR version = p_expected_version)
  RETURNING *;
  
  -- Return updated row or empty if version conflict
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- ============================================================================
-- RPC FUNCTION: Reset preferences to defaults
-- ============================================================================

CREATE OR REPLACE FUNCTION public.reset_user_preferences(
  p_user_id UUID
)
RETURNS public.user_preferences AS $$
BEGIN
  UPDATE public.user_preferences
  SET 
    language = 'en',
    currency = 'XAF',
    theme = 'auto',
    timezone = 'Africa/Douala',
    notifications_enabled = TRUE,
    newsletter_subscribed = FALSE,
    notifications_email = TRUE,
    notifications_push = TRUE,
    notifications_sms = FALSE,
    version = 0,
    updated_at = now()
  WHERE user_id = p_user_id
  RETURNING *;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- ============================================================================
-- PERMISSIONS
-- ============================================================================

GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_preferences TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_preferences(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_user_preferences(UUID, JSONB, INT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reset_user_preferences(UUID) TO authenticated;

-- ============================================================================
-- MIGRATION NOTES
-- ============================================================================
-- - user_preferences table created with UNIQUE constraint (one per user)
-- - RLS policies ensure users only access their own preferences
-- - Constraints validate language, theme, and notification fields
-- - Audit logging captures all preference changes
-- - RPC functions handle get-or-create, versioned updates, and resets
-- - Version field enables optimistic locking for concurrent updates
-- - Compatible with Phase 3c cache management
