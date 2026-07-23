CREATE TABLE IF NOT EXISTS public.telemetry_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type VARCHAR(50) NOT NULL, -- 'page_view', 'crash', 'action'
  path VARCHAR(255),
  error_message TEXT,
  device_model VARCHAR(100),
  os_name VARCHAR(50),
  os_version VARCHAR(50),
  user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  session_time_ms INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for faster analytics queries
CREATE INDEX idx_telemetry_event_type ON public.telemetry_events(event_type);
CREATE INDEX idx_telemetry_created_at ON public.telemetry_events(created_at);

-- RLS Policies
ALTER TABLE public.telemetry_events ENABLE ROW LEVEL SECURITY;

-- Anyone can insert telemetry (even anon for crashes before login)
CREATE POLICY "Anyone can insert telemetry" 
  ON public.telemetry_events FOR INSERT 
  WITH CHECK (true);

-- Only admins can read telemetry
CREATE POLICY "Admins can view telemetry" 
  ON public.telemetry_events FOR SELECT 
  USING (
    EXISTS (
      SELECT 1 FROM public.users 
      WHERE users.id = auth.uid() AND users.role = 'admin'
    )
  );
