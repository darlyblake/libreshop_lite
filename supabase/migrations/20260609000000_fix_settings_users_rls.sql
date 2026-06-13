-- 1. Fix the users table RLS policy to allow users to read their own status
CREATE POLICY "Users can view their own profile"
ON public.users
FOR SELECT
USING (auth.uid() = id);

-- 2. Create the settings table if it doesn't exist (to fix the settings error)
CREATE TABLE IF NOT EXISTS public.settings (
    key TEXT PRIMARY KEY,
    value JSONB,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- 3. Enable RLS on settings table and allow everyone to read it
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view settings" ON public.settings;
CREATE POLICY "Anyone can view settings"
ON public.settings
FOR SELECT
USING (true);

-- 4. Create the get_user_profile_secure RPC
DROP FUNCTION IF EXISTS public.get_user_profile_secure(uuid);
CREATE OR REPLACE FUNCTION public.get_user_profile_secure(user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  profile jsonb;
BEGIN
  SELECT jsonb_build_object(
    'id', id,
    'full_name', full_name,
    'email', email,
    'status', status,
    'role', role
  ) INTO profile
  FROM public.users
  WHERE id = user_id;
  
  RETURN profile;
END;
$$;

-- 5. Fix notifications insert RLS
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can insert notifications" ON public.notifications;
CREATE POLICY "Users can insert notifications"
ON public.notifications
FOR INSERT
WITH CHECK (true);

-- 6. Fix users insert/update RLS
DROP POLICY IF EXISTS "Users can insert their own profile" ON public.users;
CREATE POLICY "Users can insert their own profile"
ON public.users
FOR INSERT
WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update their own profile" ON public.users;
CREATE POLICY "Users can update their own profile"
ON public.users
FOR UPDATE
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);
