-- 1. Create settings table for global configurations
CREATE TABLE IF NOT EXISTS public.settings (
    key TEXT PRIMARY KEY,
    value JSONB NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public read access" ON public.settings;
CREATE POLICY "Allow public read access" ON public.settings FOR SELECT USING (true);

-- 2. Seed default settings
INSERT INTO public.settings (key, value)
VALUES ('require_email_confirmation', 'true'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- 3. Ensure categories table has SELECT policy if it exists
DO $$ 
BEGIN
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'categories') THEN
        IF NOT EXISTS (SELECT FROM pg_policies WHERE tablename = 'categories' AND policyname = 'Categories are viewable by everyone') THEN
            CREATE POLICY "Categories are viewable by everyone" ON public.categories FOR SELECT USING (true);
        END IF;
    END IF;
END $$;

-- 4. Seed categories if table exists and is empty
DO $$
BEGIN
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'categories') AND 
       (SELECT COUNT(*) FROM public.categories) = 0 THEN
        INSERT INTO public.categories (name, slug, icon) VALUES
        ('Électronique', 'electronique', 'laptop-outline'),
        ('Vêtements', 'vetements', 'shirt-outline'),
        ('Alimentation', 'alimentation', 'restaurant-outline'),
        ('Beauté & Soins', 'beaute-soins', 'heart-outline'),
        ('Sports & Loisirs', 'sports-loisirs', 'basketball-outline'),
        ('Maison & Jardin', 'maison-jardin', 'home-outline'),
        ('Livres & Médias', 'livres-medias', 'book-outline'),
        ('Automobile', 'automobile', 'car-outline'),
        ('Santé', 'sante', 'medical-outline'),
        ('Éducation', 'education', 'school-outline'),
        ('Services', 'services', 'briefcase-outline'),
        ('Autres', 'autres', 'ellipsis-horizontal-outline')
        ON CONFLICT (slug) DO NOTHING;
    END IF;
END $$;

-- 5. Seed Ivory Coast (Côte d'Ivoire) if countries table exists
DO $$
DECLARE
    ci_id UUID;
BEGIN
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'countries') THEN
        INSERT INTO public.countries (name, code)
        VALUES ('Côte d''Ivoire', 'CI')
        ON CONFLICT (code) DO NOTHING;
        
        SELECT id INTO ci_id FROM public.countries WHERE code = 'CI' LIMIT 1;
        
        IF ci_id IS NOT NULL AND EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'cities') THEN
            INSERT INTO public.cities (country_id, name)
            VALUES 
                (ci_id, 'Abidjan'),
                (ci_id, 'Yamoussoukro'),
                (ci_id, 'Bouaké'),
                (ci_id, 'Daloa'),
                (ci_id, 'San-Pédro'),
                (ci_id, 'Korhogo'),
                (ci_id, 'Man')
            ON CONFLICT (country_id, name) DO NOTHING;
        END IF;
    END IF;
END $$;
