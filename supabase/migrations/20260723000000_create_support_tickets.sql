-- Create support_tickets table
CREATE TABLE IF NOT EXISTS public.support_tickets (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
    user_email TEXT,
    subject TEXT NOT NULL,
    message TEXT NOT NULL,
    category TEXT DEFAULT 'general',
    status TEXT DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'resolved', 'closed')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS
ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;

-- Users can insert their own tickets
CREATE POLICY "Users can insert support tickets"
ON public.support_tickets
FOR INSERT
WITH CHECK (
    auth.uid() = user_id OR auth.uid() IS NULL
);

-- Users can view their own tickets
CREATE POLICY "Users can view own support tickets"
ON public.support_tickets
FOR SELECT
USING (auth.uid() = user_id);

-- Admins can view all tickets
CREATE POLICY "Admins can view all support tickets"
ON public.support_tickets
FOR SELECT
USING (
  COALESCE(
    (auth.jwt() -> 'user_metadata' ->> 'role'),
    (auth.jwt() -> 'app_metadata' ->> 'role')
  ) = 'admin'
);

-- Admins can update all tickets
CREATE POLICY "Admins can update all support tickets"
ON public.support_tickets
FOR UPDATE
USING (
  COALESCE(
    (auth.jwt() -> 'user_metadata' ->> 'role'),
    (auth.jwt() -> 'app_metadata' ->> 'role')
  ) = 'admin'
);

-- Seed support contacts into settings
INSERT INTO public.settings (key, value)
VALUES (
    'support_contacts', 
    '{"phone": "+24166000000", "whatsapp": "24166000000", "email": "support@libreshop.ga"}'::jsonb
)
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;
