-- ============================================================
-- TABLE: user_sessions
-- Tracks active device sessions per user.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.user_sessions (
  id            uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id       uuid        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  device_key    text        NOT NULL,           -- unique key per device
  device_name   text,                           -- ex: "Chrome — Windows", "App iOS"
  browser       text,                           -- ex: "Chrome", "Firefox", "Safari"
  os            text,                           -- ex: "Windows", "macOS", "Android"
  device_icon   text        DEFAULT 'desktop-outline',
  created_at    timestamptz DEFAULT now(),
  last_seen     timestamptz DEFAULT now(),
  CONSTRAINT uq_user_device UNIQUE (user_id, device_key)
);

-- Index for fast lookup by user
CREATE INDEX IF NOT EXISTS idx_user_sessions_user_id ON public.user_sessions(user_id);

-- ── Row Level Security ──────────────────────────────────────
ALTER TABLE public.user_sessions ENABLE ROW LEVEL SECURITY;

-- Users can SELECT their own sessions
CREATE POLICY "users_select_own_sessions"
  ON public.user_sessions FOR SELECT
  USING (auth.uid() = user_id);

-- Users can INSERT their own sessions
CREATE POLICY "users_insert_own_sessions"
  ON public.user_sessions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can UPDATE their own sessions
CREATE POLICY "users_update_own_sessions"
  ON public.user_sessions FOR UPDATE
  USING (auth.uid() = user_id);

-- Users can DELETE their own sessions
CREATE POLICY "users_delete_own_sessions"
  ON public.user_sessions FOR DELETE
  USING (auth.uid() = user_id);
