GRANT USAGE ON SCHEMA public TO anon, authenticated;

GRANT SELECT ON TABLE public.countries TO anon, authenticated;
GRANT SELECT ON TABLE public.cities TO anon, authenticated;

GRANT INSERT, UPDATE, DELETE ON TABLE public.countries TO authenticated;
GRANT INSERT, UPDATE, DELETE ON TABLE public.cities TO authenticated;
