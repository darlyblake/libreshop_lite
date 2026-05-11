-- Add low stock threshold column to products table
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS low_stock_threshold INTEGER DEFAULT 5;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS low_stock_alert_sent BOOLEAN DEFAULT false;

-- Add index for low stock queries
CREATE INDEX IF NOT EXISTS idx_products_low_stock ON public.products(stock, low_stock_threshold) WHERE stock <= low_stock_threshold;

-- Add comment
COMMENT ON COLUMN public.products.low_stock_threshold IS 'Seuil de stock faible pour déclencher une alerte. Par défaut: 5';
COMMENT ON COLUMN public.products.low_stock_alert_sent IS 'Indique si une alerte a été envoyée pour ce produit. Réinitialisé quand le stock est réapprovisionné.';
