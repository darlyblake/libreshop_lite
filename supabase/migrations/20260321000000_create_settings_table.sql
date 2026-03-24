-- Create settings table for global configurations
CREATE TABLE IF NOT EXISTS public.settings (
    key TEXT PRIMARY KEY,
    value JSONB NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Enable RLS
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;

-- Allow read access for everyone (or only authenticated if preferred)
CREATE POLICY "Allow public read access" ON public.settings
    FOR SELECT USING (true);

-- Allow update access for admins only
-- Adjust this policy based on how you identify admins in your DB
CREATE POLICY "Allow admin update" ON public.settings
    FOR ALL USING (
        auth.jwt() ->> 'email' IN (SELECT email FROM public.users WHERE role = 'admin')
    ) WITH CHECK (
        auth.jwt() ->> 'email' IN (SELECT email FROM public.users WHERE role = 'admin')
    );

-- Insert default value
INSERT INTO public.settings (key, value)
VALUES ('require_email_confirmation', 'true'::jsonb)
ON CONFLICT (key) DO NOTHING;
