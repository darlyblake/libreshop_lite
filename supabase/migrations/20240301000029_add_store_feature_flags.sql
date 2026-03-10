-- Add feature flags to stores to support AdminPaymentsScreen toggles

ALTER TABLE public.stores
ADD COLUMN IF NOT EXISTS cashier_active BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS online_store_active BOOLEAN DEFAULT true;
