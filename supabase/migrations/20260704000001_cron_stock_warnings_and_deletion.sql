-- Création de la fonction qui va traiter les alertes et les suppressions de stock
CREATE OR REPLACE FUNCTION public.process_stock_warnings_and_deletions()
RETURNS void AS $$
DECLARE
  v_product RECORD;
BEGIN
  -- 1. Phase 3 : Envoi des notifications d'alerte (3 mois)
  FOR v_product IN 
    SELECT p.id, p.name, s.user_id 
    FROM public.products p 
    JOIN public.stores s ON p.store_id = s.id
    WHERE p.stock <= 0 
      AND p.deleted_at IS NULL 
      AND p.stock_warning_sent_at IS NULL
      AND p.last_stock_zero_at <= NOW() - INTERVAL '3 months'
  LOOP
    -- Créer la notification
    INSERT INTO public.notifications (user_id, title, body, type, data)
    VALUES (
      v_product.user_id, 
      'Produit bientôt supprimé', 
      'Votre produit "' || v_product.name || '" est en rupture de stock depuis 3 mois. Mettez le stock à jour sous 7 jours sinon il sera automatiquement supprimé.', 
      'system', 
      jsonb_build_object('product_id', v_product.id, 'action', 'stock_warning')
    );
    
    -- Mettre à jour le produit pour marquer que l'alerte a été envoyée
    UPDATE public.products 
    SET stock_warning_sent_at = NOW() 
    WHERE id = v_product.id;
  END LOOP;

  -- 2. Phase 4 : Suppression des produits après 7 jours d'alerte
  FOR v_product IN 
    SELECT p.id, p.name, s.user_id 
    FROM public.products p 
    JOIN public.stores s ON p.store_id = s.id
    WHERE p.stock <= 0 
      AND p.deleted_at IS NULL 
      AND p.stock_warning_sent_at <= NOW() - INTERVAL '7 days'
  LOOP
    -- Appliquer le Soft Delete
    UPDATE public.products 
    SET 
      is_active = false, 
      deleted_at = NOW(), 
      deleted_by = v_product.user_id 
    WHERE id = v_product.id;
    
    -- Envoyer la notification finale
    INSERT INTO public.notifications (user_id, title, body, type, data)
    VALUES (
      v_product.user_id, 
      'Produit supprimé', 
      'Votre produit "' || v_product.name || '" a été retiré de votre boutique car son stock est resté à 0 pendant plus de 3 mois et 7 jours.', 
      'system', 
      jsonb_build_object('product_id', v_product.id, 'action', 'stock_deleted')
    );
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Autoriser l'accès au trigger cron
-- Activation de l'extension pg_cron (nécessite d'être un superuser)
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;

-- Planification de la tâche tous les jours à minuit
SELECT cron.schedule(
  'process_stock_warnings_and_deletions_job',
  '0 0 * * *',
  'SELECT public.process_stock_warnings_and_deletions();'
);
