-- Add store promo banner fields (seller-managed)

ALTER TABLE public.stores
ADD COLUMN IF NOT EXISTS promo_enabled BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS promo_title TEXT,
ADD COLUMN IF NOT EXISTS promo_subtitle TEXT,
ADD COLUMN IF NOT EXISTS promo_image_url TEXT,
ADD COLUMN IF NOT EXISTS promo_target_type TEXT CHECK (promo_target_type IN ('collection', 'product', 'url')),
ADD COLUMN IF NOT EXISTS promo_target_id UUID,
ADD COLUMN IF NOT EXISTS promo_target_url TEXT;
