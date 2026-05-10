-- Table pour stocker les notifications
CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('comment', 'like', 'order', 'system', 'admin')),
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  data JSONB,
  read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE
);

-- Index pour les recherches
CREATE INDEX idx_notifications_user_id ON public.notifications(user_id);
CREATE INDEX idx_notifications_type ON public.notifications(type);
CREATE INDEX idx_notifications_read ON public.notifications(read);
CREATE INDEX idx_notifications_created_at ON public.notifications(created_at DESC);

-- Table pour stocker les tokens de devices pour les notifications push
CREATE TABLE IF NOT EXISTS public.device_tokens (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  token TEXT NOT NULL,
  platform TEXT NOT NULL CHECK (platform IN ('ios', 'android', 'web')),
  device_info JSONB,
  last_used_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  UNIQUE(user_id, token)
);

-- Index pour les recherches
CREATE INDEX idx_device_tokens_user_id ON public.device_tokens(user_id);
CREATE INDEX idx_device_tokens_platform ON public.device_tokens(platform);

-- Activer RLS pour notifications
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Politiques RLS pour notifications
CREATE POLICY "Users can view own notifications" ON public.notifications FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own notifications" ON public.notifications FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own notifications" ON public.notifications FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all notifications" ON public.notifications FOR SELECT
  USING (auth.jwt() ->> 'role' = 'admin');

CREATE POLICY "Admins can insert notifications" ON public.notifications FOR INSERT
  WITH CHECK (auth.jwt() ->> 'role' = 'admin');

-- Activer RLS pour device_tokens
ALTER TABLE public.device_tokens ENABLE ROW LEVEL SECURITY;

-- Politiques RLS pour device_tokens
CREATE POLICY "Users can manage own device tokens" ON public.device_tokens FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can view all device tokens" ON public.device_tokens FOR SELECT
  USING (auth.jwt() ->> 'role' = 'admin');

CREATE POLICY "Admins can insert device tokens" ON public.device_tokens FOR INSERT
  WITH CHECK (auth.jwt() ->> 'role' = 'admin');

-- Grant permissions
GRANT ALL ON public.notifications TO service_role;
GRANT ALL ON public.device_tokens TO service_role;
GRANT SELECT, INSERT, UPDATE ON public.notifications TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.device_tokens TO authenticated;
