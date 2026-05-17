-- Ajouter cost_price à la table products
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS cost_price DECIMAL(10,2) CHECK (cost_price >= 0);

-- Ajouter cost_price à la table order_items
ALTER TABLE public.order_items ADD COLUMN IF NOT EXISTS cost_price DECIMAL(10,2) CHECK (cost_price >= 0);
