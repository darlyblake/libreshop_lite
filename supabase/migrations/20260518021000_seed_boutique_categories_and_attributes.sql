-- Migration: Seed Boutique categories, subcategories, and their dynamic JSONB attributes schema
-- Target: public.categories

-- 1. Ensure 'Mode' category exists with general attributes
DO $$
DECLARE
    v_mode_id UUID;
BEGIN
    INSERT INTO public.categories (name, slug, icon, store_type, attribute_schema)
    VALUES (
        'Mode', 
        'mode', 
        'shirt-outline', 
        'general', 
        '[
            {
                "name": "brand",
                "label": "Marque",
                "type": "text",
                "required": false
            },
            {
                "name": "condition",
                "label": "État du produit",
                "type": "select",
                "options": ["Neuf avec étiquette", "Neuf sans étiquette", "Excellent état", "Très bon état", "Bon état"],
                "required": true
            }
        ]'::jsonb
    )
    ON CONFLICT (slug) DO UPDATE 
    SET store_type = 'general', 
        attribute_schema = EXCLUDED.attribute_schema
    RETURNING id INTO v_mode_id;

    -- Subcategory 'Vêtements'
    INSERT INTO public.categories (name, slug, icon, parent_id, store_type, attribute_schema)
    VALUES (
        'Vêtements', 
        'vetements', 
        'shirt-outline', 
        v_mode_id, 
        'general', 
        '[
            {
                "name": "size",
                "label": "Tailles disponibles",
                "type": "multiselect",
                "options": ["XS", "S", "M", "L", "XL", "XXL", "XXXL"],
                "required": true
            },
            {
                "name": "color",
                "label": "Couleurs",
                "type": "multiselect",
                "options": ["Noir", "Blanc", "Gris", "Rouge", "Bleu", "Vert", "Jaune", "Rose", "Beige"],
                "required": true
            },
            {
                "name": "material",
                "label": "Matière principale",
                "type": "select",
                "options": ["Coton", "Laine", "Polyester", "Lin", "Soie", "Cuir", "Denim (Jean)"],
                "required": false
            }
        ]'::jsonb
    )
    ON CONFLICT (slug) DO UPDATE 
    SET parent_id = v_mode_id, 
        store_type = 'general', 
        attribute_schema = EXCLUDED.attribute_schema;

    -- Subcategory 'Chaussures'
    INSERT INTO public.categories (name, slug, icon, parent_id, store_type, attribute_schema)
    VALUES (
        'Chaussures', 
        'chaussures', 
        'walk-outline', 
        v_mode_id, 
        'general', 
        '[
            {
                "name": "shoe_size",
                "label": "Pointures disponibles",
                "type": "multiselect",
                "options": ["36", "37", "38", "39", "40", "41", "42", "43", "44", "45", "46"],
                "required": true
            },
            {
                "name": "color",
                "label": "Couleurs",
                "type": "multiselect",
                "options": ["Noir", "Blanc", "Gris", "Bleu", "Marron", "Rouge", "Multicolore"],
                "required": true
            }
        ]'::jsonb
    )
    ON CONFLICT (slug) DO UPDATE 
    SET parent_id = v_mode_id, 
        store_type = 'general', 
        attribute_schema = EXCLUDED.attribute_schema;

    -- Subcategory 'Sacs'
    INSERT INTO public.categories (name, slug, icon, parent_id, store_type, attribute_schema)
    VALUES (
        'Sacs', 
        'sacs', 
        'bag-handle-outline', 
        v_mode_id, 
        'general', 
        '[
            {
                "name": "material",
                "label": "Matière principale",
                "type": "select",
                "options": ["Cuir", "Simili-cuir", "Toile", "Polyester", "Paille"],
                "required": true
            },
            {
                "name": "capacity",
                "label": "Contenance / Volume (L)",
                "type": "text",
                "required": false
            }
        ]'::jsonb
    )
    ON CONFLICT (slug) DO UPDATE 
    SET parent_id = v_mode_id, 
        store_type = 'general', 
        attribute_schema = EXCLUDED.attribute_schema;
END $$;


-- 2. Ensure 'Électronique' category exists with general attributes
DO $$
DECLARE
    v_electro_id UUID;
BEGIN
    INSERT INTO public.categories (name, slug, icon, store_type, attribute_schema)
    VALUES (
        'Électronique', 
        'electronique', 
        'hardware-chip-outline', 
        'general', 
        '[
            {
                "name": "brand",
                "label": "Marque",
                "type": "text",
                "required": true
            },
            {
                "name": "warranty",
                "label": "Durée de la garantie",
                "type": "select",
                "options": ["Sans garantie", "3 mois", "6 mois", "12 mois (1 an)", "24 mois (2 ans)"],
                "required": false
            }
        ]'::jsonb
    )
    ON CONFLICT (slug) DO UPDATE 
    SET store_type = 'general', 
        attribute_schema = EXCLUDED.attribute_schema
    RETURNING id INTO v_electro_id;

    -- Subcategory 'Téléphones'
    INSERT INTO public.categories (name, slug, icon, parent_id, store_type, attribute_schema)
    VALUES (
        'Téléphones', 
        'telephones', 
        'phone-portrait-outline', 
        v_electro_id, 
        'general', 
        '[
            {
                "name": "storage",
                "label": "Espace de stockage",
                "type": "multiselect",
                "options": ["32GB", "64GB", "128GB", "256GB", "512GB", "1TB"],
                "required": true
            },
            {
                "name": "ram",
                "label": "Mémoire vive (RAM)",
                "type": "select",
                "options": ["3GB", "4GB", "6GB", "8GB", "12GB", "16GB"],
                "required": true
            }
        ]'::jsonb
    )
    ON CONFLICT (slug) DO UPDATE 
    SET parent_id = v_electro_id, 
        store_type = 'general', 
        attribute_schema = EXCLUDED.attribute_schema;

    -- Subcategory 'Ordinateurs'
    INSERT INTO public.categories (name, slug, icon, parent_id, store_type, attribute_schema)
    VALUES (
        'Ordinateurs', 
        'ordinateurs', 
        'laptop-outline', 
        v_electro_id, 
        'general', 
        '[
            {
                "name": "processor",
                "label": "Processeur",
                "type": "select",
                "options": ["Intel Core i5", "Intel Core i7", "Intel Core i9", "AMD Ryzen 5", "AMD Ryzen 7", "Apple M1", "Apple M2", "Apple M3"],
                "required": true
            },
            {
                "name": "ram",
                "label": "Mémoire vive (RAM)",
                "type": "select",
                "options": ["8GB", "16GB", "32GB", "64GB"],
                "required": true
            },
            {
                "name": "storage_type",
                "label": "Type de disque dur",
                "type": "select",
                "options": ["SSD", "HDD", "Hybride SSD+HDD"],
                "required": true
            }
        ]'::jsonb
    )
    ON CONFLICT (slug) DO UPDATE 
    SET parent_id = v_electro_id, 
        store_type = 'general', 
        attribute_schema = EXCLUDED.attribute_schema;
END $$;


-- 3. Ensure 'Maison & Déco' category exists with general attributes
DO $$
DECLARE
    v_maison_id UUID;
BEGIN
    INSERT INTO public.categories (name, slug, icon, store_type, attribute_schema)
    VALUES (
        'Maison & Déco', 
        'maison-deco', 
        'home-outline', 
        'general', 
        '[
            {
                "name": "material",
                "label": "Matière principale",
                "type": "text",
                "required": false
            }
        ]'::jsonb
    )
    ON CONFLICT (slug) DO UPDATE 
    SET store_type = 'general', 
        attribute_schema = EXCLUDED.attribute_schema
    RETURNING id INTO v_maison_id;

    -- Subcategory 'Meubles'
    INSERT INTO public.categories (name, slug, icon, parent_id, store_type, attribute_schema)
    VALUES (
        'Meubles', 
        'meubles', 
        'easel-outline', 
        v_maison_id, 
        'general', 
        '[
            {
                "name": "dimensions",
                "label": "Dimensions (L x H x P) en cm",
                "type": "text",
                "required": true
            },
            {
                "name": "color",
                "label": "Couleurs disponibles",
                "type": "multiselect",
                "options": ["Bois naturel", "Noir", "Blanc", "Gris", "Marron", "Beige"],
                "required": false
            }
        ]'::jsonb
    )
    ON CONFLICT (slug) DO UPDATE 
    SET parent_id = v_maison_id, 
        store_type = 'general', 
        attribute_schema = EXCLUDED.attribute_schema;
END $$;
