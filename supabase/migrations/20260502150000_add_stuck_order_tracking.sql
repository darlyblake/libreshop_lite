-- Migration: Add order status tracking and stuck order detection
-- Date: 2026-05-02

-- 1) Add timestamp columns to orders table
ALTER TABLE public.orders
ADD COLUMN status_changed_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL;

-- Add comment
COMMENT ON COLUMN public.orders.status_changed_at IS
'Timestamp of the last status change. Used to detect stuck orders.';

-- 2) Create order_status_thresholds table
CREATE TABLE IF NOT EXISTS public.order_status_thresholds (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  status TEXT NOT NULL UNIQUE,
  threshold_hours INTEGER NOT NULL DEFAULT 24,
  should_notify_vendor BOOLEAN DEFAULT true,
  should_notify_customer BOOLEAN DEFAULT false,
  alert_color TEXT DEFAULT 'warning', -- 'warning' (orange) or 'danger' (red)
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS for order_status_thresholds
ALTER TABLE public.order_status_thresholds ENABLE ROW LEVEL SECURITY;

-- Allow everyone to read thresholds (no secrets here)
CREATE POLICY "Anyone can view status thresholds" ON public.order_status_thresholds FOR SELECT USING (true);
CREATE POLICY "Admins can manage status thresholds" ON public.order_status_thresholds FOR ALL USING (auth.jwt() ->> 'role' = 'admin');

-- 3) Seed default thresholds
INSERT INTO public.order_status_thresholds (status, threshold_hours, should_notify_vendor, should_notify_customer, alert_color)
VALUES
  ('pending', 24, true, false, 'warning'),
  ('accepted', 48, true, false, 'danger'),
  ('paid', 72, true, true, 'warning'),
  ('shipped', 168, true, true, 'warning')
ON CONFLICT (status) DO NOTHING;

-- 4) Create a function to get stuck orders for a store
CREATE OR REPLACE FUNCTION public.get_stuck_orders(p_store_id UUID)
RETURNS TABLE (
  order_id UUID,
  status TEXT,
  hours_in_status NUMERIC,
  threshold_hours INTEGER,
  is_stuck BOOLEAN,
  alert_color TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    o.id,
    o.status,
    EXTRACT(EPOCH FROM (now() - o.status_changed_at)) / 3600 AS hours_in_status,
    t.threshold_hours,
    (EXTRACT(EPOCH FROM (now() - o.status_changed_at)) / 3600) > t.threshold_hours AS is_stuck,
    t.alert_color
  FROM public.orders o
  LEFT JOIN public.order_status_thresholds t ON o.status = t.status
  WHERE o.store_id = p_store_id
    AND o.status NOT IN ('delivered', 'cancelled')
    AND (EXTRACT(EPOCH FROM (now() - o.status_changed_at)) / 3600) > COALESCE(t.threshold_hours, 999)
  ORDER BY (EXTRACT(EPOCH FROM (now() - o.status_changed_at)) / 3600) DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.get_stuck_orders(UUID) TO authenticated, anon;

-- 5) Create trigger to update status_changed_at when status changes
CREATE OR REPLACE FUNCTION public.update_order_status_changed_at()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    NEW.status_changed_at := now();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_order_status_changed_at ON public.orders;
CREATE TRIGGER trigger_update_order_status_changed_at
  BEFORE UPDATE ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.update_order_status_changed_at();
