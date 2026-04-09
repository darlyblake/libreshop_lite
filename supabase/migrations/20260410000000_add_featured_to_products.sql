-- Add featured column to products table for home page display
ALTER TABLE public.products
ADD COLUMN featured BOOLEAN DEFAULT false;

-- Create index for featured products retrieval
CREATE INDEX idx_products_featured_store ON public.products(store_id, featured) WHERE featured = true;
