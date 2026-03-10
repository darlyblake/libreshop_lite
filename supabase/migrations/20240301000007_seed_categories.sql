-- Insertion des catégories par défaut
INSERT INTO public.categories (name, slug, icon) VALUES
('Électronique', 'electronique', 'phone-portrait'),
('Vêtements', 'vetements', 'shirt'),
('Alimentation', 'alimentation', 'restaurant'),
('Beauté & Soins', 'beaute-soins', 'heart'),
('Sports & Loisirs', 'sports-loisirs', 'football'),
('Maison & Jardin', 'maison-jardin', 'home'),
('Livres & Médias', 'livres-medias', 'book'),
('Automobile', 'automobile', 'car'),
('Santé', 'sante', 'medical'),
('Éducation', 'education', 'school'),
('Services', 'services', 'briefcase'),
('Autres', 'autres', 'ellipsis-horizontal')
ON CONFLICT (slug) DO NOTHING;
