CREATE TABLE IF NOT EXISTS public.countries (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  code TEXT NOT NULL UNIQUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE IF NOT EXISTS public.cities (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  country_id UUID NOT NULL REFERENCES public.countries(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  UNIQUE(country_id, name)
);

ALTER TABLE public.countries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cities ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Countries are readable" ON public.countries;
CREATE POLICY "Countries are readable" ON public.countries
FOR SELECT
USING (true);

DROP POLICY IF EXISTS "Cities are readable" ON public.cities;
CREATE POLICY "Cities are readable" ON public.cities
FOR SELECT
USING (true);

DROP POLICY IF EXISTS "Admins can manage countries (metadata role)" ON public.countries;
CREATE POLICY "Admins can manage countries (metadata role)" ON public.countries
FOR ALL
TO authenticated
USING (
  COALESCE(
    auth.jwt() -> 'user_metadata' ->> 'role',
    auth.jwt() -> 'app_metadata' ->> 'role'
  ) = 'admin'
)
WITH CHECK (
  COALESCE(
    auth.jwt() -> 'user_metadata' ->> 'role',
    auth.jwt() -> 'app_metadata' ->> 'role'
  ) = 'admin'
);

DROP POLICY IF EXISTS "Admins can manage cities (metadata role)" ON public.cities;
CREATE POLICY "Admins can manage cities (metadata role)" ON public.cities
FOR ALL
TO authenticated
USING (
  COALESCE(
    auth.jwt() -> 'user_metadata' ->> 'role',
    auth.jwt() -> 'app_metadata' ->> 'role'
  ) = 'admin'
)
WITH CHECK (
  COALESCE(
    auth.jwt() -> 'user_metadata' ->> 'role',
    auth.jwt() -> 'app_metadata' ->> 'role'
  ) = 'admin'
);

ALTER TABLE public.stores
ADD COLUMN IF NOT EXISTS email TEXT,
ADD COLUMN IF NOT EXISTS phone TEXT,
ADD COLUMN IF NOT EXISTS address TEXT,
ADD COLUMN IF NOT EXISTS country_id UUID REFERENCES public.countries(id),
ADD COLUMN IF NOT EXISTS city_id UUID REFERENCES public.cities(id);

INSERT INTO public.countries (name, code)
VALUES ('Gabon', 'GA')
ON CONFLICT (code) DO NOTHING;

WITH ga AS (
  SELECT id FROM public.countries WHERE code = 'GA' LIMIT 1
)
INSERT INTO public.cities (country_id, name)
SELECT ga.id, v.name
FROM ga
CROSS JOIN (
  VALUES
    ('Libreville'),
    ('Port-Gentil'),
    ('Franceville'),
    ('Oyem'),
    ('Moanda'),
    ('Lambaréné'),
    ('Mouila'),
    ('Tchibanga'),
    ('Makokou'),
    ('Koulamoutou')
) AS v(name)
ON CONFLICT (country_id, name) DO NOTHING;
