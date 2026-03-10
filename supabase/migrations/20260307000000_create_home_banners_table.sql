-- Create home_banners table (admin-managed announcements for ClientHome)

CREATE TABLE IF NOT EXISTS public.home_banners (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  placement TEXT NOT NULL DEFAULT 'carousel' CHECK (placement IN ('carousel', 'promo')),
  title TEXT NOT NULL,
  subtitle TEXT,
  image_url TEXT,
  color TEXT,
  link_screen TEXT,
  link_params JSONB,
  position INTEGER NOT NULL DEFAULT 0,
  start_at TIMESTAMPTZ,
  end_at TIMESTAMPTZ,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS home_banners_active_position_idx
  ON public.home_banners (is_active, position);

CREATE INDEX IF NOT EXISTS home_banners_active_placement_position_idx
  ON public.home_banners (is_active, placement, position);

ALTER TABLE public.home_banners ENABLE ROW LEVEL SECURITY;

-- Public read: only active banners and within date range if set
DROP POLICY IF EXISTS "Public can view active home banners" ON public.home_banners;
CREATE POLICY "Public can view active home banners"
ON public.home_banners
FOR SELECT
USING (
  is_active = true
  AND (start_at IS NULL OR start_at <= now())
  AND (end_at IS NULL OR end_at >= now())
);

-- Admin manage: CRUD everything (role is stored in jwt metadata in this app)
DROP POLICY IF EXISTS "Admins can manage home banners" ON public.home_banners;
CREATE POLICY "Admins can manage home banners"
ON public.home_banners
FOR ALL
TO authenticated
USING (
  COALESCE(
    auth.jwt() -> 'user_metadata' ->> 'role',
    auth.jwt() -> 'app_metadata' ->> 'role'
  ) = 'admin'
)
WITH CHECK (
  COALESCE(
    auth.jwt() -> 'user_metadata' ->> 'role',
    auth.jwt() -> 'app_metadata' ->> 'role'
  ) = 'admin'
);
