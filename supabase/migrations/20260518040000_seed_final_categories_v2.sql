-- Migration: Seed Final Comprehensive Categories V2
-- Target: public.categories
-- Description: Wipes all existing categories and seeds the definitive 10 main categories and their subcategories.

-- 1. Nettoyage total
DELETE FROM public.categories;

-- 2. Insertion
DO $$
DECLARE
    v_mode UUID;
    v_chaussures UUID;
    v_electro UUID;
    v_beaute UUID;
    v_maison UUID;
    v_alim UUID;
    v_sports UUID;
    v_auto UUID;
    v_sante UUID;
    v_enfants UUID;
BEGIN
    -- ==========================================
    -- 1. Mode & Vêtements
    -- ==========================================
    INSERT INTO public.categories (name, slug, icon, store_type, attribute_schema)
    VALUES ('Mode & Vêtements', 'mode', 'shirt-outline', 'general', '[
        {"name": "brand", "label": "Marque", "type": "text", "required": false},
        {"name": "gender", "label": "Genre", "type": "select", "options": ["Homme", "Femme", "Enfant", "Mixte"], "required": true},
        {"name": "material", "label": "Matière principale", "type": "text", "required": false},
        {"name": "condition", "label": "État", "type": "select", "options": ["Neuf avec étiquette", "Neuf sans étiquette", "Très bon état", "Bon état", "Satisfaisant"], "required": true}
    ]'::jsonb) RETURNING id INTO v_mode;

    INSERT INTO public.categories (name, slug, icon, parent_id, store_type, attribute_schema) VALUES 
    ('Vêtements Homme', 'vetements-homme', 'man-outline', v_mode, 'general', '[{"name": "size", "label": "Taille", "type": "multiselect", "options": ["XS", "S", "M", "L", "XL", "XXL"], "required": true}, {"name": "color", "label": "Couleurs", "type": "multiselect", "options": ["Noir", "Blanc", "Bleu", "Gris", "Rouge", "Vert", "Beige"], "required": true}, {"name": "style", "label": "Style", "type": "select", "options": ["Casual", "Sport", "Business", "Soirée"], "required": false}]'::jsonb),
    ('Vêtements Femme', 'vetements-femme', 'woman-outline', v_mode, 'general', '[{"name": "size", "label": "Taille", "type": "multiselect", "options": ["34", "36", "38", "40", "42", "44", "46"], "required": true}, {"name": "color", "label": "Couleurs", "type": "multiselect", "options": ["Noir", "Blanc", "Rouge", "Rose", "Bleu", "Vert", "Beige"], "required": true}, {"name": "style", "label": "Style", "type": "select", "options": ["Casual", "Soirée", "Sport", "Business"], "required": false}, {"name": "length", "label": "Longueur", "type": "select", "options": ["Court", "Midi", "Long"], "required": false}]'::jsonb),
    ('Vêtements Enfant', 'vetements-enfant', 'happy-outline', v_mode, 'general', '[{"name": "age_group", "label": "Tranche d''âge", "type": "select", "options": ["0-2 ans", "3-5 ans", "6-9 ans", "10-14 ans"], "required": true}, {"name": "size", "label": "Taille (en cm ou âge)", "type": "text", "required": true}, {"name": "color", "label": "Couleurs", "type": "multiselect", "options": ["Noir", "Blanc", "Rose", "Bleu", "Jaune", "Vert", "Rouge"], "required": true}]'::jsonb),
    ('Sous-vêtements', 'sous-vetements', 'shirt-outline', v_mode, 'general', '[]'::jsonb),
    ('Vêtements Traditionnels', 'vetements-traditionnels', 'color-palette-outline', v_mode, 'general', '[]'::jsonb);

    -- ==========================================
    -- 2. Chaussures & Sacs
    -- ==========================================
    INSERT INTO public.categories (name, slug, icon, store_type, attribute_schema)
    VALUES ('Chaussures & Sacs', 'chaussures-sacs', 'walk-outline', 'general', '[
        {"name": "brand", "label": "Marque", "type": "text", "required": false},
        {"name": "color", "label": "Couleurs", "type": "multiselect", "options": ["Noir", "Blanc", "Marron", "Beige", "Bleu", "Rouge"], "required": true},
        {"name": "material", "label": "Matière", "type": "select", "options": ["Cuir", "Toile", "Synthétique", "Daim", "Velours"], "required": false},
        {"name": "size", "label": "Pointure / Taille", "type": "text", "required": true}
    ]'::jsonb) RETURNING id INTO v_chaussures;

    INSERT INTO public.categories (name, slug, icon, parent_id, store_type, attribute_schema) VALUES 
    ('Chaussures Homme', 'chaussures-homme', 'footsteps-outline', v_chaussures, 'general', '[]'::jsonb),
    ('Chaussures Femme', 'chaussures-femme', 'footsteps-outline', v_chaussures, 'general', '[]'::jsonb),
    ('Chaussures Enfant', 'chaussures-enfant', 'footsteps-outline', v_chaussures, 'general', '[]'::jsonb),
    ('Sacs & Bagagerie', 'sacs', 'bag-handle-outline', v_chaussures, 'general', '[]'::jsonb),
    ('Ceintures & Accessoires', 'accessoires-chaussures', 'git-commit-outline', v_chaussures, 'general', '[]'::jsonb);

    -- ==========================================
    -- 3. Électronique & Informatique
    -- ==========================================
    INSERT INTO public.categories (name, slug, icon, store_type, attribute_schema)
    VALUES ('Électronique & Informatique', 'electronique', 'hardware-chip-outline', 'general', '[
        {"name": "brand", "label": "Marque", "type": "text", "required": true},
        {"name": "warranty", "label": "Garantie", "type": "select", "options": ["Sans garantie", "3 mois", "6 mois", "1 an", "2 ans"], "required": false},
        {"name": "condition", "label": "État", "type": "select", "options": ["Neuf scellé", "Neuf ouvert", "Reconditionné", "Occasion parfait état", "Occasion bon état"], "required": true}
    ]'::jsonb) RETURNING id INTO v_electro;

    INSERT INTO public.categories (name, slug, icon, parent_id, store_type, attribute_schema) VALUES 
    ('Téléphones', 'telephones', 'phone-portrait-outline', v_electro, 'general', '[{"name": "storage", "label": "Stockage", "type": "select", "options": ["32 Go", "64 Go", "128 Go", "256 Go", "512 Go", "1 To"], "required": true}, {"name": "ram", "label": "Mémoire RAM", "type": "select", "options": ["2 Go", "3 Go", "4 Go", "6 Go", "8 Go", "12 Go", "16 Go"], "required": true}, {"name": "screen_size", "label": "Taille de l''écran (pouces)", "type": "text", "required": false}]'::jsonb),
    ('Ordinateurs & Laptops', 'ordinateurs', 'laptop-outline', v_electro, 'general', '[{"name": "processor", "label": "Processeur", "type": "text", "required": true}, {"name": "ram", "label": "Mémoire RAM", "type": "select", "options": ["4 Go", "8 Go", "16 Go", "32 Go", "64 Go"], "required": true}, {"name": "storage", "label": "Stockage (Disque dur)", "type": "select", "options": ["256 Go SSD", "512 Go SSD", "1 To SSD", "2 To SSD", "1 To HDD"], "required": true}, {"name": "screen_size", "label": "Taille de l''écran", "type": "text", "required": true}]'::jsonb),
    ('Accessoires Téléphone', 'accessoires-telephones', 'headset-outline', v_electro, 'general', '[]'::jsonb),
    ('Écouteurs & Audio', 'audio', 'musical-notes-outline', v_electro, 'general', '[]'::jsonb),
    ('Chargeurs & Câbles', 'chargeurs', 'battery-charging-outline', v_electro, 'general', '[]'::jsonb);

    -- ==========================================
    -- 4. Beauté & Soins
    -- ==========================================
    INSERT INTO public.categories (name, slug, icon, store_type, attribute_schema)
    VALUES ('Beauté & Soins', 'beaute-soins', 'sparkles-outline', 'general', '[
        {"name": "brand", "label": "Marque", "type": "text", "required": false},
        {"name": "gender", "label": "Genre visé", "type": "select", "options": ["Femme", "Homme", "Unisexe"], "required": false},
        {"name": "skin_type", "label": "Type de peau", "type": "select", "options": ["Tous types", "Sèche", "Grasse", "Mixte", "Sensible"], "required": false}
    ]'::jsonb) RETURNING id INTO v_beaute;

    INSERT INTO public.categories (name, slug, icon, parent_id, store_type, attribute_schema) VALUES 
    ('Maquillage', 'maquillage', 'brush-outline', v_beaute, 'general', '[{"name": "shade", "label": "Teinte / Couleur", "type": "text", "required": false}, {"name": "category", "label": "Type de maquillage", "type": "select", "options": ["Lèvres", "Yeux", "Teint", "Ongles"], "required": false}]'::jsonb),
    ('Soins du Visage', 'soins-visage', 'water-outline', v_beaute, 'general', '[]'::jsonb),
    ('Parfums', 'parfums', 'flask-outline', v_beaute, 'general', '[{"name": "volume", "label": "Volume (ml)", "type": "text", "required": true}]'::jsonb),
    ('Cheveux', 'cheveux', 'cut-outline', v_beaute, 'general', '[{"name": "hair_type", "label": "Type de cheveux", "type": "select", "options": ["Tous", "Lisses", "Bouclés", "Crépus", "Colorés", "Secs", "Gras"], "required": false}]'::jsonb),
    ('Hygiène', 'hygiene', 'medkit-outline', v_beaute, 'general', '[]'::jsonb);

    -- ==========================================
    -- 5. Maison & Déco
    -- ==========================================
    INSERT INTO public.categories (name, slug, icon, store_type, attribute_schema)
    VALUES ('Maison & Déco', 'maison-deco', 'home-outline', 'general', '[
        {"name": "material", "label": "Matière", "type": "text", "required": false},
        {"name": "color", "label": "Couleurs disponibles", "type": "multiselect", "options": ["Bois", "Noir", "Blanc", "Gris", "Métal", "Multicolore"], "required": false},
        {"name": "dimensions", "label": "Dimensions (L x l x H)", "type": "text", "required": false}
    ]'::jsonb) RETURNING id INTO v_maison;

    INSERT INTO public.categories (name, slug, icon, parent_id, store_type, attribute_schema) VALUES 
    ('Meubles', 'meubles', 'bed-outline', v_maison, 'general', '[]'::jsonb),
    ('Électroménager', 'electromenager', 'flash-outline', v_maison, 'general', '[]'::jsonb),
    ('Vaisselle & Cuisine', 'vaisselle', 'restaurant-outline', v_maison, 'general', '[]'::jsonb),
    ('Décoration', 'decoration', 'images-outline', v_maison, 'general', '[]'::jsonb),
    ('Linge de Maison', 'linge-maison', 'bed-outline', v_maison, 'general', '[]'::jsonb);

    -- ==========================================
    -- 6. Alimentation & Boissons
    -- ==========================================
    INSERT INTO public.categories (name, slug, icon, store_type, attribute_schema)
    VALUES ('Alimentation & Boissons', 'alimentation', 'cart-outline', 'general', '[
        {"name": "brand", "label": "Marque / Producteur", "type": "text", "required": false},
        {"name": "weight", "label": "Poids net", "type": "text", "required": false},
        {"name": "expiry_date", "label": "Date limite de consommation (DLC)", "type": "text", "required": false}
    ]'::jsonb) RETURNING id INTO v_alim;

    INSERT INTO public.categories (name, slug, icon, parent_id, store_type, attribute_schema) VALUES 
    ('Épicerie', 'epicerie', 'basket-outline', v_alim, 'general', '[]'::jsonb),
    ('Boissons', 'boissons', 'wine-outline', v_alim, 'general', '[{"name": "volume", "label": "Volume (cl ou L)", "type": "text", "required": true}, {"name": "type", "label": "Type de boisson", "type": "select", "options": ["Alcoolisé", "Non-alcoolisé", "Jus", "Eau", "Gazeux"], "required": true}]'::jsonb),
    ('Produits Frais', 'produits-frais', 'leaf-outline', v_alim, 'general', '[]'::jsonb),
    ('Snacks & Biscuits', 'snacks', 'pizza-outline', v_alim, 'general', '[]'::jsonb);

    -- ==========================================
    -- 7. Sports & Loisirs
    -- ==========================================
    INSERT INTO public.categories (name, slug, icon, store_type, attribute_schema)
    VALUES ('Sports & Loisirs', 'sports-loisirs', 'football-outline', 'general', '[
        {"name": "brand", "label": "Marque", "type": "text", "required": false},
        {"name": "sport_type", "label": "Type de sport", "type": "text", "required": true}
    ]'::jsonb) RETURNING id INTO v_sports;

    INSERT INTO public.categories (name, slug, icon, parent_id, store_type, attribute_schema) VALUES 
    ('Vêtements Sport', 'vetements-sport', 'shirt-outline', v_sports, 'general', '[]'::jsonb),
    ('Équipements Fitness', 'equipement-fitness', 'barbell-outline', v_sports, 'general', '[]'::jsonb),
    ('Ballons & Accessoires', 'ballons', 'basketball-outline', v_sports, 'general', '[]'::jsonb),
    ('Pêche & Chasse', 'peche-chasse', 'boat-outline', v_sports, 'general', '[]'::jsonb);

    -- ==========================================
    -- 8. Automobile & Moto
    -- ==========================================
    INSERT INTO public.categories (name, slug, icon, store_type, attribute_schema)
    VALUES ('Automobile & Moto', 'automobile', 'car-sport-outline', 'general', '[
        {"name": "brand", "label": "Marque (Fabricant)", "type": "text", "required": true},
        {"name": "condition", "label": "État", "type": "select", "options": ["Neuf", "Occasion", "Reconditionné"], "required": true},
        {"name": "year", "label": "Année du modèle", "type": "number", "required": false}
    ]'::jsonb) RETURNING id INTO v_auto;

    INSERT INTO public.categories (name, slug, icon, parent_id, store_type, attribute_schema) VALUES 
    ('Pièces Détachées', 'pieces-detachees', 'settings-outline', v_auto, 'general', '[]'::jsonb),
    ('Accessoires Auto', 'accessoires-auto', 'speedometer-outline', v_auto, 'general', '[]'::jsonb),
    ('Pneus', 'pneus', 'disc-outline', v_auto, 'general', '[]'::jsonb),
    ('Moto & Scooters', 'moto', 'bicycle-outline', v_auto, 'general', '[]'::jsonb);

    -- ==========================================
    -- 9. Santé & Bien-être
    -- ==========================================
    INSERT INTO public.categories (name, slug, icon, store_type, attribute_schema)
    VALUES ('Santé & Bien-être', 'sante', 'fitness-outline', 'general', '[
        {"name": "brand", "label": "Marque / Laboratoire", "type": "text", "required": false},
        {"name": "usage", "label": "Mode d''utilisation", "type": "text", "required": false}
    ]'::jsonb) RETURNING id INTO v_sante;

    INSERT INTO public.categories (name, slug, icon, parent_id, store_type, attribute_schema) VALUES 
    ('Compléments Alimentaires', 'complements', 'nutrition-outline', v_sante, 'general', '[]'::jsonb),
    ('Matériel Médical', 'materiel-medical', 'medical-outline', v_sante, 'general', '[]'::jsonb),
    ('Soins Naturels', 'soins-naturels', 'leaf-outline', v_sante, 'general', '[]'::jsonb);

    -- ==========================================
    -- 10. Enfants & Bébé
    -- ==========================================
    INSERT INTO public.categories (name, slug, icon, store_type, attribute_schema)
    VALUES ('Enfants & Bébé', 'enfants-bebe', 'people-outline', 'general', '[
        {"name": "age_group", "label": "Tranche d''âge", "type": "select", "options": ["0-6 mois", "6-12 mois", "1-3 ans", "4-7 ans", "8-12 ans", "13+ ans"], "required": true}
    ]'::jsonb) RETURNING id INTO v_enfants;

    INSERT INTO public.categories (name, slug, icon, parent_id, store_type, attribute_schema) VALUES 
    ('Jouets', 'jouets', 'game-controller-outline', v_enfants, 'general', '[]'::jsonb),
    ('Vêtements Bébé', 'vetements-bebe', 'body-outline', v_enfants, 'general', '[]'::jsonb),
    ('Puériculture', 'puericulture', 'bed-outline', v_enfants, 'general', '[]'::jsonb);

END $$;
