-- Migration: Seed Non-General Categories (Restaurants, Hôtels, Logement, Bars)
-- Target: public.categories
-- Description: Seeds the core category structures and their specific parameters for non-general store types.

DO $$
DECLARE
    v_resto UUID;
    v_hotel UUID;
    v_logement UUID;
    v_bar UUID;
BEGIN
    -- ==========================================
    -- 1. Restaurants (restaurant)
    -- ==========================================
    INSERT INTO public.categories (name, slug, icon, store_type, attribute_schema)
    VALUES ('Restaurants', 'restaurants', 'restaurant-outline', 'restaurant', '[
        {"name": "cuisine_type", "label": "Type de cuisine", "type": "text", "required": true},
        {"name": "price_range", "label": "Fourchette de prix", "type": "select", "options": ["€", "€€", "€€€", "€€€€"], "required": false},
        {"name": "service_type", "label": "Type de service", "type": "multiselect", "options": ["Sur place", "À emporter", "Livraison"], "required": true}
    ]'::jsonb) RETURNING id INTO v_resto;

    INSERT INTO public.categories (name, slug, icon, parent_id, store_type, attribute_schema) VALUES 
    ('Cuisine Gabonaise', 'cuisine-gabonaise', 'restaurant-outline', v_resto, 'restaurant', '[{"name": "spicy_level", "label": "Niveau de piment", "type": "select", "options": ["Pas pimenté", "Doux", "Moyen", "Fort"], "required": false}, {"name": "signature_dish", "label": "Plat signature", "type": "text", "required": false}]'::jsonb),
    ('Cuisine Africaine', 'cuisine-africaine', 'restaurant-outline', v_resto, 'restaurant', '[{"name": "country_origin", "label": "Pays d''origine", "type": "text", "required": false}, {"name": "main_ingredient", "label": "Ingrédient principal", "type": "text", "required": false}]'::jsonb),
    ('Fast Food', 'fast-food', 'fast-food-outline', v_resto, 'restaurant', '[{"name": "menu_type", "label": "Type de menu", "type": "select", "options": ["Burger", "Pizza", "Poulet", "Tacos", "Kebab"], "required": false}]'::jsonb),
    ('Snack / Street Food', 'snack-street-food', 'cafe-outline', v_resto, 'restaurant', '[{"name": "snack_type", "label": "Type d''encas", "type": "text", "required": false}, {"name": "opening_hours", "label": "Heures d''ouverture", "type": "text", "required": false}]'::jsonb),
    ('Grillades & Barbecue', 'grillades-barbecue', 'flame-outline', v_resto, 'restaurant', '[{"name": "meat_type", "label": "Type de viande", "type": "multiselect", "options": ["Poulet", "Bœuf", "Porc", "Mouton", "Poisson"], "required": false}]'::jsonb),
    ('Poisson & Fruits de Mer', 'poisson-fruits-mer', 'water-outline', v_resto, 'restaurant', '[{"name": "freshness", "label": "Fraîcheur", "type": "select", "options": ["Frais du jour", "Surgelé"], "required": false}]'::jsonb),
    ('Pizza & Italienne', 'pizza-italienne', 'pizza-outline', v_resto, 'restaurant', '[{"name": "crust_type", "label": "Type de pâte", "type": "select", "options": ["Fine", "Épaisse", "Pan", "Fourrée au fromage"], "required": false}]'::jsonb),
    ('Asiatique', 'asiatique', 'restaurant-outline', v_resto, 'restaurant', '[{"name": "cuisine_origin", "label": "Origine", "type": "select", "options": ["Chinois", "Japonais", "Thaïlandais", "Coréen"], "required": false}]'::jsonb),
    ('Libanaise / Orientale', 'libanaise-orientale', 'restaurant-outline', v_resto, 'restaurant', '[{"name": "halal", "label": "Certifié Halal", "type": "select", "options": ["Oui", "Non"], "required": false}]'::jsonb),
    ('Desserts & Pâtisseries', 'desserts-patisseries', 'ice-cream-outline', v_resto, 'restaurant', '[{"name": "sweet_type", "label": "Type de douceurs", "type": "select", "options": ["Gâteau", "Glace", "Viennoiserie", "Mignardise"], "required": false}]'::jsonb);

    -- ==========================================
    -- 2. Hôtels, Hébergements & Motels (hotel)
    -- ==========================================
    INSERT INTO public.categories (name, slug, icon, store_type, attribute_schema)
    VALUES ('Hôtels & Hébergements', 'hotels-hebergements', 'bed-outline', 'hotel', '[
        {"name": "star_rating", "label": "Étoiles", "type": "select", "options": ["1 étoile", "2 étoiles", "3 étoiles", "4 étoiles", "5 étoiles"], "required": false},
        {"name": "amenities", "label": "Équipements", "type": "multiselect", "options": ["Wi-Fi", "Climatisation", "Piscine", "Parking gratuit", "Petit-déjeuner", "Spa", "Salle de sport"], "required": false},
        {"name": "price_per_night", "label": "Prix par nuit", "type": "number", "required": true}
    ]'::jsonb) RETURNING id INTO v_hotel;

    INSERT INTO public.categories (name, slug, icon, parent_id, store_type, attribute_schema) VALUES 
    ('Hôtels Luxe', 'hotels-luxe', 'ribbon-outline', v_hotel, 'hotel', '[{"name": "room_category", "label": "Catégorie de chambre", "type": "select", "options": ["Suite Junior", "Suite Présidentielle", "Villa Privée"], "required": false}, {"name": "view_type", "label": "Type de vue", "type": "select", "options": ["Vue Mer", "Vue Jardin", "Vue Ville", "Vue Piscine"], "required": false}]'::jsonb),
    ('Hôtels Standard', 'hotels-standard', 'bed-outline', v_hotel, 'hotel', '[{"name": "room_category", "label": "Catégorie de chambre", "type": "select", "options": ["Chambre Simple", "Chambre Double", "Chambre Familiale"], "required": false}, {"name": "breakfast_included", "label": "Petit-déjeuner inclus", "type": "select", "options": ["Oui", "Non"], "required": false}]'::jsonb),
    ('Motel', 'motel', 'car-outline', v_hotel, 'hotel', '[{"name": "hourly_rate", "label": "Tarif horaire", "type": "number", "required": false}, {"name": "short_stay", "label": "Court séjour possible", "type": "select", "options": ["Oui", "Non"], "required": false}, {"name": "parking", "label": "Parking devant chambre", "type": "select", "options": ["Oui", "Non"], "required": false}]'::jsonb),
    ('Auberges & Guest Houses', 'auberges-guest-houses', 'people-outline', v_hotel, 'hotel', '[{"name": "shared_bathroom", "label": "Salle de bain partagée", "type": "select", "options": ["Oui", "Non"], "required": false}, {"name": "host_on_site", "label": "Hôte sur place", "type": "select", "options": ["Oui", "Non"], "required": false}]'::jsonb),
    ('Résidences / Appart-Hôtels', 'residences-appart-hotels', 'business-outline', v_hotel, 'hotel', '[{"name": "kitchen_available", "label": "Cuisine équipée", "type": "select", "options": ["Oui", "Non"], "required": false}, {"name": "min_stay", "label": "Séjour minimum (nuits)", "type": "number", "required": false}]'::jsonb),
    ('Chambres d''hôtes', 'chambres-hotes', 'home-outline', v_hotel, 'hotel', '[{"name": "meals_included", "label": "Repas inclus", "type": "select", "options": ["Petit-déjeuner seul", "Demi-pension", "Pension complète"], "required": false}]'::jsonb),
    ('Campements / Éco-lodges', 'campements-eco-lodges', 'leaf-outline', v_hotel, 'hotel', '[{"name": "nature_access", "label": "Accès nature", "type": "select", "options": ["Forêt", "Plage", "Rivière", "Montagne"], "required": false}, {"name": "pool", "label": "Piscine naturelle", "type": "select", "options": ["Oui", "Non"], "required": false}]'::jsonb);

    -- ==========================================
    -- 3. Immobilier & Locations (logement)
    -- ==========================================
    INSERT INTO public.categories (name, slug, icon, store_type, attribute_schema)
    VALUES ('Immobilier & Locations', 'immobilier-locations', 'home-outline', 'logement', '[
        {"name": "property_type", "label": "Type de bien", "type": "select", "options": ["Appartement", "Maison", "Chambre", "Studio", "Local commercial", "Terrain"], "required": true},
        {"name": "monthly_rent", "label": "Loyer mensuel / Prix", "type": "number", "required": true},
        {"name": "availability_status", "label": "Disponibilité", "type": "select", "options": ["Immédiate", "Sous conditions", "Sur réservation"], "required": true}
    ]'::jsonb) RETURNING id INTO v_logement;

    INSERT INTO public.categories (name, slug, icon, parent_id, store_type, attribute_schema) VALUES 
    ('Appartements', 'appartements', 'business-outline', v_logement, 'logement', '[{"name": "bedrooms", "label": "Nombre de chambres", "type": "number", "required": true}, {"name": "bathrooms", "label": "Salles de bain", "type": "number", "required": false}, {"name": "floor", "label": "Étage", "type": "number", "required": false}, {"name": "furnished", "label": "Meublé", "type": "select", "options": ["Oui", "Non"], "required": false}]'::jsonb),
    ('Maisons', 'maisons', 'home-outline', v_logement, 'logement', '[{"name": "bedrooms", "label": "Nombre de chambres", "type": "number", "required": true}, {"name": "bathrooms", "label": "Salles de bain", "type": "number", "required": false}, {"name": "garden", "label": "Jardin", "type": "select", "options": ["Oui", "Non"], "required": false}, {"name": "garage", "label": "Garage", "type": "select", "options": ["Oui", "Non"], "required": false}]'::jsonb),
    ('Chambres Meublées', 'chambres-meublees', 'bed-outline', v_logement, 'logement', '[{"name": "room_size", "label": "Superficie de la chambre (m²)", "type": "number", "required": false}, {"name": "shared_kitchen", "label": "Cuisine partagée", "type": "select", "options": ["Oui", "Non"], "required": false}]'::jsonb),
    ('Studios', 'studios', 'square-outline', v_logement, 'logement', '[{"name": "kitchenette", "label": "Cuisine", "type": "select", "options": ["Américaine", "Intégrée", "Absente"], "required": false}]'::jsonb),
    ('Villas & Luxe', 'villas-luxe', 'ribbon-outline', v_logement, 'logement', '[{"name": "pool", "label": "Piscine", "type": "select", "options": ["Oui", "Non"], "required": false}, {"name": "garden_size", "label": "Taille du jardin (m²)", "type": "number", "required": false}, {"name": "security", "label": "Gardiennage / Sécurité", "type": "select", "options": ["Oui", "Non"], "required": false}]'::jsonb),
    ('Terrains à bâtir', 'terrains-batir', 'map-outline', v_logement, 'logement', '[{"name": "land_size", "label": "Superficie (m²)", "type": "number", "required": true}, {"name": "zoning", "label": "Zonage", "type": "select", "options": ["Résidentiel", "Commercial", "Agricole"], "required": false}]'::jsonb),
    ('Locaux Commerciaux', 'locaux-commerciaux', 'briefcase-outline', v_logement, 'logement', '[{"name": "office_space", "label": "Espace bureau (m²)", "type": "number", "required": false}, {"name": "parking_spaces", "label": "Places de parking", "type": "number", "required": false}]'::jsonb),
    ('Locations Saisonnières', 'locations-saisonnieres', 'calendar-outline', v_logement, 'logement', '[{"name": "min_stay", "label": "Séjour minimum (nuits)", "type": "number", "required": false}, {"name": "weekly_rate", "label": "Tarif hebdomadaire", "type": "number", "required": false}]'::jsonb);

    -- ==========================================
    -- 4. Bars, Snack Bars & Boîtes de Nuit (bar)
    -- ==========================================
    INSERT INTO public.categories (name, slug, icon, store_type, attribute_schema)
    VALUES ('Bars & Vie Nocturne', 'bars-vie-nocturne', 'beer-outline', 'bar', '[
        {"name": "venue_type", "label": "Type d''établissement", "type": "select", "options": ["Bar", "Lounge", "Snack Bar", "Boîte de Nuit", "Pub", "Karaoké"], "required": true},
        {"name": "music_type", "label": "Style de musique", "type": "select", "options": ["Afrobeat", "Jazz", "Electro", "R&B/Pop", "Variété", "Pas de musique"], "required": false},
        {"name": "entry_fee", "label": "Frais d''entrée", "type": "number", "required": false}
    ]'::jsonb) RETURNING id INTO v_bar;

    INSERT INTO public.categories (name, slug, icon, parent_id, store_type, attribute_schema) VALUES 
    ('Bar / Lounge', 'bar-lounge', 'beer-outline', v_bar, 'bar', '[{"name": "drink_specialty", "label": "Cocktail signature", "type": "text", "required": false}, {"name": "happy_hour", "label": "Happy Hour", "type": "select", "options": ["Oui", "Non"], "required": false}]'::jsonb),
    ('Snack Bar', 'snack-bar', 'cafe-outline', v_bar, 'bar', '[{"name": "snack_type", "label": "Type d''encas", "type": "text", "required": false}, {"name": "opening_hours_night", "label": "Heures d''ouverture nuit", "type": "text", "required": false}]'::jsonb),
    ('Boîte de Nuit', 'boite-de-nuit', 'musical-notes-outline', v_bar, 'bar', '[{"name": "music_type", "label": "Genre musical dominant", "type": "text", "required": false}, {"name": "has_dancefloor", "label": "Piste de danse", "type": "select", "options": ["Oui", "Non"], "required": false}, {"name": "dress_code", "label": "Code vestimentaire", "type": "select", "options": ["Correct exigé", "Décontracté", "Chic"], "required": false}]'::jsonb),
    ('Pub & Brasserie', 'pub-brasserie', 'pint-outline', v_bar, 'bar', '[{"name": "beer_selection", "label": "Sélection de bières", "type": "text", "required": false}]'::jsonb),
    ('Terrasse / Bar Extérieur', 'terrasse-bar-exterieur', 'sunny-outline', v_bar, 'bar', '[{"name": "outdoor_seating", "label": "Places en terrasse", "type": "number", "required": false}]'::jsonb),
    ('Karaoké', 'karaoke', 'mic-outline', v_bar, 'bar', '[{"name": "karaoke_available", "label": "Micro/Écrans dispos", "type": "select", "options": ["Oui", "Non"], "required": false}]'::jsonb);

END $$;
