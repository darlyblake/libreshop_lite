-- Ajouter les colonnes manquantes hasCaisse et hasOnlineStore à la table plans
-- Cela résout le problème PGRST204 où ces colonnes n'existent pas dans le schéma

ALTER TABLE public.plans 
ADD COLUMN IF NOT EXISTS "hasCaisse" BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS "hasOnlineStore" BOOLEAN DEFAULT true;

-- Mettre à jour les données existantes pour utiliser les nouvelles colonnes
-- en se basant sur les valeurs des colonnes existantes (has_caisse, has_online_store)
UPDATE public.plans 
SET "hasCaisse" = has_caisse,
    "hasOnlineStore" = has_online_store
WHERE "hasCaisse" IS DISTINCT FROM has_caisse 
   OR "hasOnlineStore" IS DISTINCT FROM has_online_store;
