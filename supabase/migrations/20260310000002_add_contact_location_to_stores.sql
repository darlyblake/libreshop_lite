-- Add contact and location columns to stores table
ALTER TABLE public.stores 
ADD COLUMN IF NOT EXISTS email TEXT,
ADD COLUMN IF NOT EXISTS phone TEXT,
ADD COLUMN IF NOT EXISTS address TEXT,
ADD COLUMN IF NOT EXISTS country_id UUID,
ADD COLUMN IF NOT EXISTS city_id UUID;
