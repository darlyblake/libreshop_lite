-- Create system_alerts table for global issues
CREATE TABLE IF NOT EXISTS public.system_alerts (
    key TEXT PRIMARY KEY,
    message TEXT NOT NULL,
    is_active BOOLEAN DEFAULT true,
    severity TEXT DEFAULT 'warning' CHECK (severity IN ('info', 'warning', 'danger')),
    last_occurred TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Enable RLS
ALTER TABLE public.system_alerts ENABLE ROW LEVEL SECURITY;

-- Allow public read access (so dashboard can show it)
DROP POLICY IF EXISTS "Allow public read access" ON public.system_alerts;
CREATE POLICY "Allow public read access" ON public.system_alerts
    FOR SELECT USING (true);

-- Allow anyone to update the alert (so client can report issues)
-- We use an UPSERT pattern in the service
DROP POLICY IF EXISTS "Allow public upsert alerts" ON public.system_alerts;
CREATE POLICY "Allow public upsert alerts" ON public.system_alerts
    FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Allow public update alerts" ON public.system_alerts;
CREATE POLICY "Allow public update alerts" ON public.system_alerts
    FOR UPDATE USING (true);

-- Insert default entry for AI tokens (inactive by default)
INSERT INTO public.system_alerts (key, message, is_active, severity)
VALUES ('ai_tokens_exhausted', 'Les tokens IA (Grok/Gemini) sont épuisés. La recherche fonctionne en mode dégradé.', false, 'danger')
ON CONFLICT (key) DO NOTHING;
