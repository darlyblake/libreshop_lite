-- Add customer_name to orders so seller can see the name entered at checkout
ALTER TABLE public.orders
ADD COLUMN IF NOT EXISTS customer_name TEXT;
