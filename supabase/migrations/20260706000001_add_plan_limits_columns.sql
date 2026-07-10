-- Migration: Ajouter les colonnes de limites à la table plans
-- Cette migration ajoute les colonnes pour gérer les limites de coupons, collections et analytics retention

-- Ajouter les colonnes à la table plans
ALTER TABLE plans 
ADD COLUMN IF NOT EXISTS max_coupons INTEGER,
ADD COLUMN IF NOT EXISTS max_collections INTEGER,
ADD COLUMN IF NOT EXISTS analytics_retention_days INTEGER;

-- Mettre à jour les plans existants avec les valeurs par défaut
UPDATE plans 
SET max_coupons = CASE 
  WHEN LOWER(name) = 'trial' THEN 3
  WHEN LOWER(name) = 'standard' THEN 5
  WHEN LOWER(name) = 'pro' THEN 10
  WHEN LOWER(name) = 'business' THEN 20
  WHEN LOWER(name) = 'enterprise' THEN NULL
  ELSE NULL
END
WHERE max_coupons IS NULL;

UPDATE plans 
SET max_collections = CASE 
  WHEN LOWER(name) = 'trial' THEN 3
  WHEN LOWER(name) = 'standard' THEN 5
  WHEN LOWER(name) = 'pro' THEN 10
  WHEN LOWER(name) = 'business' THEN 20
  WHEN LOWER(name) = 'enterprise' THEN NULL
  ELSE NULL
END
WHERE max_collections IS NULL;

UPDATE plans 
SET analytics_retention_days = CASE 
  WHEN LOWER(name) = 'trial' THEN 7
  WHEN LOWER(name) = 'standard' THEN 30
  WHEN LOWER(name) = 'pro' THEN 90
  WHEN LOWER(name) = 'business' THEN 365
  WHEN LOWER(name) = 'enterprise' THEN NULL
  ELSE NULL
END
WHERE analytics_retention_days IS NULL;
