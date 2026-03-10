-- Créer l'utilisateur admin manuellement
INSERT INTO public.users (id, email, full_name, role)
VALUES ('49a0bc2f-6c10-49b7-80fd-2ae90f91bfc6', 'darlyblake@gmail.com', 'darlyblake', 'admin')
ON CONFLICT (id) DO UPDATE SET 
  full_name = EXCLUDED.full_name,
  role = EXCLUDED.role,
  updated_at = timezone('utc'::text, now());
