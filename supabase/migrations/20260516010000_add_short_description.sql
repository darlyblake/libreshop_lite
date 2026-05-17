-- Migration: ajouter la colonne manquante short_description à la table products
-- Cette colonne est requise par le trigger products_search_vector_update()
-- Date: 2026-05-16

ALTER TABLE public.products ADD COLUMN IF NOT EXISTS short_description TEXT;

-- Mettre à jour le commentaire
COMMENT ON COLUMN public.products.short_description IS 'Description courte du produit utilisée pour la recherche et les aperçus.';
