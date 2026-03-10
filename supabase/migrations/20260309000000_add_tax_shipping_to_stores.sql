-- Ajouter les colonnes tax_rate et shipping_price à la table stores
ALTER TABLE public.stores 
ADD COLUMN tax_rate DECIMAL(5,2) DEFAULT 0.00,
ADD COLUMN shipping_price INTEGER DEFAULT 0;
