-- Corriger les icônes invalides dans les catégories
UPDATE public.categories SET icon = 'phone-portrait' WHERE icon = 'phone';
UPDATE public.categories SET icon = 'add-circle' WHERE icon = 'test';
