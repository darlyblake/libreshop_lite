-- Migration: Recréer les plans d'abonnement par défaut
-- Cette migration crée les 5 plans avec toutes les fonctionnalités et limites configurées

-- Supprimer tous les plans existants (attention: cela supprime toutes les données)
DELETE FROM plans;

-- Insérer le plan Trial
INSERT INTO plans (name, price, duration, months, trial_days, product_limit, max_coupons, max_collections, analytics_retention_days, has_caisse, has_online_store, has_analytics, features, status) VALUES
('Trial', 0, 'mois', 1, 30, 20, 3, 3, 7, true, true, true, ARRAY['dashboard_basic','dashboard_advanced','products_management','orders_management','pos_caisse','analytics_basic','analytics_advanced','analytics_coach_ai','analytics_benchmark','clients_basic','clients_advanced','loyalty_program','coupons_basic','coupons_unlimited','collections_basic','collections_unlimited','reports_basic','reports_advanced','reports_detailed','export_data','low_stock_alerts','stock_history','returns_management','refunds_basic','refunds_advanced','finance_basic','accounting_advanced','support_email'], 'active');

-- Insérer le plan Standard
INSERT INTO plans (name, price, duration, months, trial_days, product_limit, max_coupons, max_collections, analytics_retention_days, has_caisse, has_online_store, has_analytics, features, status) VALUES
('Standard', 2500, 'mois', NULL, NULL, 50, 5, 5, 30, true, true, false, ARRAY['dashboard_basic','products_management','orders_management','pos_caisse','analytics_basic','clients_basic','coupons_basic','collections_basic','reports_basic','low_stock_alerts','returns_management','refunds_basic','finance_basic','support_email'], 'active');

-- Insérer le plan Pro
INSERT INTO plans (name, price, duration, months, trial_days, product_limit, max_coupons, max_collections, analytics_retention_days, has_caisse, has_online_store, has_analytics, features, status) VALUES
('Pro', 10000, 'mois', NULL, NULL, 200, 10, 10, 90, true, true, true, ARRAY['dashboard_basic','dashboard_advanced','products_management','orders_management','pos_caisse','analytics_basic','analytics_advanced','analytics_coach_ai','analytics_benchmark','clients_basic','clients_advanced','loyalty_program','coupons_basic','coupons_unlimited','collections_basic','collections_unlimited','reports_basic','reports_advanced','reports_detailed','export_data','low_stock_alerts','stock_history','returns_management','refunds_advanced','finance_basic','support_email'], 'active');

-- Insérer le plan Business
INSERT INTO plans (name, price, duration, months, trial_days, product_limit, max_coupons, max_collections, analytics_retention_days, has_caisse, has_online_store, has_analytics, features, status) VALUES
('Business', 25000, 'mois', NULL, NULL, NULL, 20, 20, 365, true, true, true, ARRAY['dashboard_basic','dashboard_advanced','products_management','orders_management','pos_caisse','analytics_basic','analytics_advanced','analytics_coach_ai','analytics_benchmark','clients_basic','clients_advanced','loyalty_program','coupons_basic','coupons_unlimited','collections_basic','collections_unlimited','reports_basic','reports_advanced','reports_detailed','export_data','low_stock_alerts','stock_history','returns_management','refunds_advanced','finance_basic','accounting_advanced','api_access','multi_store','support_email','support_phone'], 'active');

-- Insérer le plan Enterprise
INSERT INTO plans (name, price, duration, months, trial_days, product_limit, max_coupons, max_collections, analytics_retention_days, has_caisse, has_online_store, has_analytics, features, status) VALUES
('Enterprise', 50000, 'mois', NULL, NULL, NULL, NULL, NULL, NULL, true, true, true, ARRAY['dashboard_basic','dashboard_advanced','products_management','orders_management','pos_caisse','analytics_basic','analytics_advanced','analytics_coach_ai','analytics_benchmark','clients_basic','clients_advanced','loyalty_program','coupons_basic','coupons_unlimited','collections_basic','collections_unlimited','reports_basic','reports_advanced','reports_detailed','export_data','low_stock_alerts','stock_history','returns_management','refunds_advanced','finance_basic','accounting_advanced','api_access','multi_store','support_email','support_phone','support_24_7','white_label','custom_development'], 'active');
