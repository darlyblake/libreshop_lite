-- Add billing fields to stores to support AdminPaymentsScreen

ALTER TABLE public.stores
ADD COLUMN IF NOT EXISTS billing_status TEXT DEFAULT 'pending' CHECK (billing_status IN ('paid', 'pending', 'overdue')),
ADD COLUMN IF NOT EXISTS last_payment_date DATE,
ADD COLUMN IF NOT EXISTS next_billing_date DATE,
ADD COLUMN IF NOT EXISTS subscription_price DECIMAL(10,2);
