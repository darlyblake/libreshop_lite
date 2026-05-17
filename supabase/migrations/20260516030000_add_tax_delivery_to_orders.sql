-- Migration: Ajouter TVA et Livraison à la table des commandes
-- Date: 2026-05-16

ALTER TABLE public.orders 
ADD COLUMN IF NOT EXISTS tax_amount DECIMAL(10,2) DEFAULT 0.00,
ADD COLUMN IF NOT EXISTS delivery_fee DECIMAL(10,2) DEFAULT 0.00;

-- Mise à jour des commentaires
COMMENT ON COLUMN public.orders.tax_amount IS 'Montant total de la TVA collectée sur cette commande.';
COMMENT ON COLUMN public.orders.delivery_fee IS 'Montant des frais de livraison facturés pour cette commande.';
