-- Ajout des champs pour le suivi du stock à 0 et la suppression automatique
ALTER TABLE public.products
ADD COLUMN IF NOT EXISTS last_stock_zero_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS stock_warning_sent_at TIMESTAMP WITH TIME ZONE;

COMMENT ON COLUMN public.products.last_stock_zero_at IS 'Date à laquelle le stock est tombé à 0 pour la dernière fois.';
COMMENT ON COLUMN public.products.stock_warning_sent_at IS 'Date à laquelle la notification de suppression imminente a été envoyée (après 3 mois de stock à 0).';

-- Trigger pour mettre à jour automatiquement ces champs quand le stock change
CREATE OR REPLACE FUNCTION public.trg_update_stock_zero_tracking()
RETURNS TRIGGER AS $$
BEGIN
  -- Si le stock tombe à 0
  IF NEW.stock <= 0 AND OLD.stock > 0 THEN
    NEW.last_stock_zero_at = NOW();
  -- Si le stock remonte au-dessus de 0
  ELSIF NEW.stock > 0 THEN
    NEW.last_stock_zero_at = NULL;
    NEW.stock_warning_sent_at = NULL;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_stock_zero_tracking ON public.products;
CREATE TRIGGER trigger_update_stock_zero_tracking
BEFORE UPDATE OF stock ON public.products
FOR EACH ROW
EXECUTE FUNCTION public.trg_update_stock_zero_tracking();

-- Optionnel: Rétroactif pour les produits déjà à 0
UPDATE public.products 
SET last_stock_zero_at = updated_at 
WHERE stock <= 0 AND last_stock_zero_at IS NULL;

-- Mise à jour de la vue v_similar_products
DROP VIEW IF EXISTS public.v_similar_products;
CREATE OR REPLACE VIEW public.v_similar_products AS
 SELECT id, store_id, name, description, price, compare_price, stock, reference, images, is_active, is_online_sale, is_physical_sale, category, created_at, updated_at, collection_id, sale_active, sale_price, discount_percent, sale_start_date, sale_end_date, view_count, featured, tags, synonyms, attributes, search_vector, embedding, low_stock_threshold, low_stock_alert_sent, cost_price, short_description, deleted_at, deleted_by, last_stock_zero_at, stock_warning_sent_at
   FROM public.products;

