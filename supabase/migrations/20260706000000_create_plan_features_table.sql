-- Migration: Création de la table plan_features pour gérer les fonctionnalités par plan d'abonnement
-- Cette table permet de stocker quelles fonctionnalités sont activées pour chaque plan

-- Créer la table plan_features
CREATE TABLE IF NOT EXISTS plan_features (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  plan_name VARCHAR(50) NOT NULL,
  feature_key VARCHAR(100) NOT NULL,
  is_enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(plan_name, feature_key)
);

-- Créer un index pour optimiser les requêtes
CREATE INDEX IF NOT EXISTS idx_plan_features_plan_name ON plan_features(plan_name);
CREATE INDEX IF NOT EXISTS idx_plan_features_feature_key ON plan_features(feature_key);

-- Activer Row Level Security
ALTER TABLE plan_features ENABLE ROW LEVEL SECURITY;

-- Politique RLS: Permettre aux utilisateurs authentifiés de gérer la table
-- (L'écran admin est protégé par le rôle utilisateur, donc c'est sécurisé)
CREATE POLICY "Authenticated can manage plan_features"
  ON plan_features FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Trigger pour mettre à jour updated_at automatiquement
CREATE OR REPLACE FUNCTION update_plan_features_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS plan_features_updated_at ON plan_features;
CREATE TRIGGER plan_features_updated_at
  BEFORE UPDATE ON plan_features
  FOR EACH ROW
  EXECUTE FUNCTION update_plan_features_updated_at();

-- Insérer les fonctionnalités par défaut pour chaque plan
-- Plan Trial (1 mois, toutes les fonctionnalités activées pour tester)
INSERT INTO plan_features (plan_name, feature_key, is_enabled) VALUES
  ('trial', 'dashboard_basic', true),
  ('trial', 'dashboard_advanced', true),
  ('trial', 'products_management', true),
  ('trial', 'orders_management', true),
  ('trial', 'pos_caisse', true),
  ('trial', 'analytics_basic', true),
  ('trial', 'analytics_advanced', true),
  ('trial', 'analytics_coach_ai', true),
  ('trial', 'analytics_benchmark', true),
  ('trial', 'clients_basic', true),
  ('trial', 'clients_advanced', true),
  ('trial', 'loyalty_program', true),
  ('trial', 'coupons_basic', true),
  ('trial', 'coupons_unlimited', true),
  ('trial', 'collections_basic', true),
  ('trial', 'collections_unlimited', true),
  ('trial', 'reports_basic', true),
  ('trial', 'reports_advanced', true),
  ('trial', 'reports_detailed', true),
  ('trial', 'export_data', true),
  ('trial', 'low_stock_alerts', true),
  ('trial', 'stock_history', true),
  ('trial', 'returns_management', true),
  ('trial', 'refunds_basic', true),
  ('trial', 'refunds_advanced', true),
  ('trial', 'finance_basic', true),
  ('trial', 'accounting_advanced', true),
  ('trial', 'support_email', true)
ON CONFLICT (plan_name, feature_key) DO NOTHING;

-- Plan Standard (2 500 FCFA, fonctionnalités de base)
INSERT INTO plan_features (plan_name, feature_key, is_enabled) VALUES
  ('standard', 'dashboard_basic', true),
  ('standard', 'products_management', true),
  ('standard', 'orders_management', true),
  ('standard', 'pos_caisse', true),
  ('standard', 'analytics_basic', true),
  ('standard', 'clients_basic', true),
  ('standard', 'coupons_basic', true),
  ('standard', 'collections_basic', true),
  ('standard', 'reports_basic', true),
  ('standard', 'low_stock_alerts', true),
  ('standard', 'returns_management', true),
  ('standard', 'refunds_basic', true),
  ('standard', 'finance_basic', true),
  ('standard', 'support_email', true),
  -- Fonctionnalités désactivées pour Standard
  ('standard', 'dashboard_advanced', false),
  ('standard', 'analytics_advanced', false),
  ('standard', 'analytics_coach_ai', false),
  ('standard', 'analytics_benchmark', false),
  ('standard', 'clients_advanced', false),
  ('standard', 'loyalty_program', false),
  ('standard', 'coupons_unlimited', false),
  ('standard', 'collections_unlimited', false),
  ('standard', 'reports_advanced', false),
  ('standard', 'reports_detailed', false),
  ('standard', 'export_data', false),
  ('standard', 'stock_history', false),
  ('standard', 'refunds_advanced', false),
  ('standard', 'accounting_advanced', false)
ON CONFLICT (plan_name, feature_key) DO NOTHING;

-- Plan Pro (10 000 FCFA, fonctionnalités avancées)
INSERT INTO plan_features (plan_name, feature_key, is_enabled) VALUES
  ('pro', 'dashboard_basic', true),
  ('pro', 'dashboard_advanced', true),
  ('pro', 'products_management', true),
  ('pro', 'orders_management', true),
  ('pro', 'pos_caisse', true),
  ('pro', 'analytics_basic', true),
  ('pro', 'analytics_advanced', true),
  ('pro', 'analytics_coach_ai', true),
  ('pro', 'analytics_benchmark', true),
  ('pro', 'clients_basic', true),
  ('pro', 'clients_advanced', true),
  ('pro', 'loyalty_program', true),
  ('pro', 'coupons_basic', true),
  ('pro', 'coupons_unlimited', true),
  ('pro', 'collections_basic', true),
  ('pro', 'collections_unlimited', true),
  ('pro', 'reports_basic', true),
  ('pro', 'reports_advanced', true),
  ('pro', 'reports_detailed', true),
  ('pro', 'export_data', true),
  ('pro', 'low_stock_alerts', true),
  ('pro', 'stock_history', true),
  ('pro', 'returns_management', true),
  ('pro', 'refunds_advanced', true),
  ('pro', 'finance_basic', true),
  ('pro', 'support_email', true),
  -- Fonctionnalités désactivées pour Pro
  ('pro', 'accounting_advanced', false),
  ('pro', 'api_access', false),
  ('pro', 'multi_store', false),
  ('pro', 'support_phone', false)
ON CONFLICT (plan_name, feature_key) DO NOTHING;

-- Plan Business (25 000 FCFA, multi-boutiques et comptabilité)
INSERT INTO plan_features (plan_name, feature_key, is_enabled) VALUES
  ('business', 'dashboard_basic', true),
  ('business', 'dashboard_advanced', true),
  ('business', 'products_management', true),
  ('business', 'orders_management', true),
  ('business', 'pos_caisse', true),
  ('business', 'analytics_basic', true),
  ('business', 'analytics_advanced', true),
  ('business', 'analytics_coach_ai', true),
  ('business', 'analytics_benchmark', true),
  ('business', 'clients_basic', true),
  ('business', 'clients_advanced', true),
  ('business', 'loyalty_program', true),
  ('business', 'coupons_basic', true),
  ('business', 'coupons_unlimited', true),
  ('business', 'collections_basic', true),
  ('business', 'collections_unlimited', true),
  ('business', 'reports_basic', true),
  ('business', 'reports_advanced', true),
  ('business', 'reports_detailed', true),
  ('business', 'export_data', true),
  ('business', 'low_stock_alerts', true),
  ('business', 'stock_history', true),
  ('business', 'returns_management', true),
  ('business', 'refunds_advanced', true),
  ('business', 'finance_basic', true),
  ('business', 'accounting_advanced', true),
  ('business', 'api_access', true),
  ('business', 'multi_store', true),
  ('business', 'support_email', true),
  ('business', 'support_phone', true),
  -- Fonctionnalités désactivées pour Business
  ('business', 'support_24_7', false),
  ('business', 'white_label', false),
  ('business', 'custom_development', false)
ON CONFLICT (plan_name, feature_key) DO NOTHING;

-- Plan Enterprise (sur devis, tout illimité)
INSERT INTO plan_features (plan_name, feature_key, is_enabled) VALUES
  ('enterprise', 'dashboard_basic', true),
  ('enterprise', 'dashboard_advanced', true),
  ('enterprise', 'products_management', true),
  ('enterprise', 'orders_management', true),
  ('enterprise', 'pos_caisse', true),
  ('enterprise', 'analytics_basic', true),
  ('enterprise', 'analytics_advanced', true),
  ('enterprise', 'analytics_coach_ai', true),
  ('enterprise', 'analytics_benchmark', true),
  ('enterprise', 'clients_basic', true),
  ('enterprise', 'clients_advanced', true),
  ('enterprise', 'loyalty_program', true),
  ('enterprise', 'coupons_basic', true),
  ('enterprise', 'coupons_unlimited', true),
  ('enterprise', 'collections_basic', true),
  ('enterprise', 'collections_unlimited', true),
  ('enterprise', 'reports_basic', true),
  ('enterprise', 'reports_advanced', true),
  ('enterprise', 'reports_detailed', true),
  ('enterprise', 'export_data', true),
  ('enterprise', 'low_stock_alerts', true),
  ('enterprise', 'stock_history', true),
  ('enterprise', 'returns_management', true),
  ('enterprise', 'refunds_advanced', true),
  ('enterprise', 'finance_basic', true),
  ('enterprise', 'accounting_advanced', true),
  ('enterprise', 'api_access', true),
  ('enterprise', 'multi_store', true),
  ('enterprise', 'support_email', true),
  ('enterprise', 'support_phone', true),
  ('enterprise', 'support_24_7', true),
  ('enterprise', 'white_label', true),
  ('enterprise', 'custom_development', true)
ON CONFLICT (plan_name, feature_key) DO NOTHING;

-- Fonction utilitaire pour obtenir les fonctionnalités d'un plan
CREATE OR REPLACE FUNCTION get_plan_features(plan_name_param VARCHAR(50))
RETURNS TABLE (feature_key VARCHAR(100), is_enabled BOOLEAN) AS $$
BEGIN
  RETURN QUERY
  SELECT pf.feature_key, pf.is_enabled
  FROM plan_features pf
  WHERE pf.plan_name = plan_name_param;
END;
$$ LANGUAGE plpgsql;

-- Fonction utilitaire pour vérifier si une fonctionnalité est activée pour un plan
CREATE OR REPLACE FUNCTION is_feature_enabled(plan_name_param VARCHAR(50), feature_key_param VARCHAR(100))
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM plan_features
    WHERE plan_name = plan_name_param
    AND feature_key = feature_key_param
    AND is_enabled = true
  );
END;
$$ LANGUAGE plpgsql;

-- Fonction utilitaire pour activer une fonctionnalité pour un plan
CREATE OR REPLACE FUNCTION enable_plan_feature(plan_name_param VARCHAR(50), feature_key_param VARCHAR(100))
RETURNS BOOLEAN AS $$
BEGIN
  INSERT INTO plan_features (plan_name, feature_key, is_enabled)
  VALUES (plan_name_param, feature_key_param, true)
  ON CONFLICT (plan_name, feature_key)
  DO UPDATE SET is_enabled = true, updated_at = NOW();
  RETURN true;
EXCEPTION
  WHEN OTHERS THEN
    RETURN false;
END;
$$ LANGUAGE plpgsql;

-- Fonction utilitaire pour désactiver une fonctionnalité pour un plan
CREATE OR REPLACE FUNCTION disable_plan_feature(plan_name_param VARCHAR(50), feature_key_param VARCHAR(100))
RETURNS BOOLEAN AS $$
BEGIN
  INSERT INTO plan_features (plan_name, feature_key, is_enabled)
  VALUES (plan_name_param, feature_key_param, false)
  ON CONFLICT (plan_name, feature_key)
  DO UPDATE SET is_enabled = false, updated_at = NOW();
  RETURN true;
EXCEPTION
  WHEN OTHERS THEN
    RETURN false;
END;
$$ LANGUAGE plpgsql;
