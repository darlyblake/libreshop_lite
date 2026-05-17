-- Add dynamic delivery columns to stores table
ALTER TABLE public.stores 
ADD COLUMN IF NOT EXISTS delivery_mode TEXT DEFAULT 'fixed' CHECK (delivery_mode IN ('fixed', 'km', 'city')),
ADD COLUMN IF NOT EXISTS delivery_price_km NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS delivery_city_fees JSONB DEFAULT '{}'::jsonb;

-- Comment for documentation
COMMENT ON COLUMN public.stores.delivery_mode IS 'Mode de calcul des frais de livraison: prix fixe, au KM, ou par ville';
COMMENT ON COLUMN public.stores.delivery_price_km IS 'Prix facturé par kilomètre de distance';
COMMENT ON COLUMN public.stores.delivery_city_fees IS 'Dictionnaire JSON des frais fixes par ville';

-- Add delivery location to orders table
ALTER TABLE public.orders
ADD COLUMN IF NOT EXISTS city TEXT,
ADD COLUMN IF NOT EXISTS latitude NUMERIC,
ADD COLUMN IF NOT EXISTS longitude NUMERIC;

COMMENT ON COLUMN public.orders.city IS 'Ville de livraison renseignée par le client';
COMMENT ON COLUMN public.orders.latitude IS 'Latitude GPS de livraison';
COMMENT ON COLUMN public.orders.longitude IS 'Longitude GPS de livraison';
