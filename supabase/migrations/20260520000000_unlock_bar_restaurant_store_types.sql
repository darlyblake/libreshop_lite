-- ============================================================
-- Migration : Débloquer Restaurant (🍳) et Bar / Lounge (🍹)
-- comme types de boutique « actifs » sur la page de création
-- de boutique (SellerAddStore).
-- ------------------------------------------------------------
-- Cette migration met à jour l'entrée 'store_types' dans la
-- table public.settings afin que les types 'restaurant' et
-- 'bar' passent en status 'active' (au lieu de 'avenir').
-- Les types personnalisés éventuellement ajoutés par l'admin
-- sont préservés.
-- ============================================================

UPDATE public.settings
SET value = (
    SELECT jsonb_agg(
        CASE
            WHEN elem->>'id' IN ('restaurant', 'bar')
                THEN elem || '{"status":"active"}'::jsonb
            ELSE elem
        END
    )
    FROM jsonb_array_elements(value) AS elem
),
updated_at = NOW()
WHERE key = 'store_types'
  AND value IS NOT NULL;

-- Vérification (optionnelle) : afficher le résultat
-- SELECT key, jsonb_pretty(value) AS value
-- FROM public.settings
-- WHERE key = 'store_types';
