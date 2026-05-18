-- Migration: Add dynamic store types and dynamic attributes schema
-- Target: stores, categories, collections, products

-- 1. Table stores: Add store_type column
ALTER TABLE public.stores 
ADD COLUMN IF NOT EXISTS store_type TEXT DEFAULT 'general' 
CHECK (store_type IN ('general', 'restaurant', 'bar', 'hotel', 'logement'));

-- 2. Table categories: Add store_type and attribute_schema columns
ALTER TABLE public.categories 
ADD COLUMN IF NOT EXISTS store_type TEXT DEFAULT 'general';

ALTER TABLE public.categories 
ADD COLUMN IF NOT EXISTS attribute_schema JSONB DEFAULT '[]'::jsonb;

-- 3. Table collections: Add category_id reference
ALTER TABLE public.collections 
ADD COLUMN IF NOT EXISTS category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL;

-- 4. Table products: Add attributes column
ALTER TABLE public.products 
ADD COLUMN IF NOT EXISTS attributes JSONB DEFAULT '{}'::jsonb;

-- 5. Seed some dynamic attribute schemas for default categories (Retrocompatible backfill)
-- Let's update or create categories with dynamic parameters:
-- A. Category 'Mode' / Subcategory 'Vêtements' (General shop)
DO $$
DECLARE
    v_mode_id UUID;
    v_vetements_id UUID;
BEGIN
    -- Ensure Mode category exists
    INSERT INTO public.categories (name, slug, icon, store_type)
    VALUES ('Mode', 'mode', 'shirt-outline', 'general')
    ON CONFLICT (slug) DO UPDATE SET store_type = 'general'
    RETURNING id INTO v_mode_id;

    -- Ensure Vêtements subcategory exists under Mode
    INSERT INTO public.categories (name, slug, icon, parent_id, store_type, attribute_schema)
    VALUES (
        'Vêtements', 
        'vetements', 
        'shirt-outline', 
        v_mode_id, 
        'general', 
        '[
            {
                "name": "color",
                "label": "Couleurs disponibles",
                "type": "multiselect",
                "options": ["Rouge", "Bleu", "Noir", "Blanc", "Gris", "Vert"],
                "required": true
            },
            {
                "name": "size",
                "label": "Tailles disponibles",
                "type": "multiselect",
                "options": ["S", "M", "L", "XL", "XXL"],
                "required": true
            },
            {
                "name": "material",
                "label": "Matière",
                "type": "select",
                "options": ["Coton", "Polyester", "Laine", "Lin", "Soie"],
                "required": false
            }
        ]'::jsonb
    )
    ON CONFLICT (slug) DO UPDATE 
    SET parent_id = v_mode_id, 
        store_type = 'general', 
        attribute_schema = EXCLUDED.attribute_schema;
END $$;

-- B. Category 'Restauration' / Subcategory 'Plats' (Restaurant/Bar)
DO $$
DECLARE
    v_resto_id UUID;
    v_plats_id UUID;
BEGIN
    -- Ensure Restauration category exists
    INSERT INTO public.categories (name, slug, icon, store_type)
    VALUES ('Restauration', 'restauration', 'restaurant-outline', 'restaurant')
    ON CONFLICT (slug) DO UPDATE SET store_type = 'restaurant'
    RETURNING id INTO v_resto_id;

    -- Ensure Plats subcategory exists under Restauration
    INSERT INTO public.categories (name, slug, icon, parent_id, store_type, attribute_schema)
    VALUES (
        'Plats', 
        'plats', 
        'restaurant-outline', 
        v_resto_id, 
        'restaurant', 
        '[
            {
                "name": "spiciness",
                "label": "Niveau de piment",
                "type": "select",
                "options": ["Non pimenté", "Doux", "Moyen", "Très épicé"],
                "required": true
            },
            {
                "name": "allergens",
                "label": "Allergènes",
                "type": "multiselect",
                "options": ["Gluten", "Lactose", "Arachides", "Coquillages", "Soya"],
                "required": false
            },
            {
                "name": "cooking_time",
                "label": "Temps de préparation (mins)",
                "type": "number",
                "required": false
            }
        ]'::jsonb
    )
    ON CONFLICT (slug) DO UPDATE 
    SET parent_id = v_resto_id, 
        store_type = 'restaurant', 
        attribute_schema = EXCLUDED.attribute_schema;
END $$;
