-- Migration: Add 'accepted' status to orders table
-- Date: 2026-05-02

-- Drop the existing constraint and recreate with 'accepted' status
ALTER TABLE public.orders
DROP CONSTRAINT orders_status_check;

ALTER TABLE public.orders
ADD CONSTRAINT orders_status_check CHECK (status IN ('pending', 'accepted', 'paid', 'shipped', 'delivered', 'cancelled'));

-- Add comment for documentation
COMMENT ON CONSTRAINT orders_status_check ON public.orders IS
'Check constraint for valid order statuses: pending (initial state), accepted (vendor accepted), paid (payment confirmed), shipped (in transit), delivered (received), cancelled (order cancelled).';
