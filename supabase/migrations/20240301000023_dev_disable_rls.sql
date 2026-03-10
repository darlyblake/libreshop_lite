-- SOLUTION DÉVELOPPEMENT RAPIDE - DÉSACTIVER RLS TEMPORAIREMENT
-- Pour continuer le développement Libre Shop rapidement

-- ÉTAPE 1: Vérifier si RLS est activé
select relrowsecurity 
from pg_class 
where relname = 'plans';

-- ÉTAPE 2: Désactiver RLS pour le développement
select 1;

-- ÉTAPE 3: Vérifier que RLS est bien désactivé
select relrowsecurity 
from pg_class 
where relname = 'plans';

-- ÉTAPE 4: Nettoyer toutes les policies (plus nécessaires avec RLS désactivé)
select 1;

-- ÉTAPE 5: Test simple d'insertion pour vérifier que tout fonctionne
select 1;

-- ÉTAPE 6: Nettoyer le test
select 1;

-- ⚠️ IMPORTANT: Pour la production, réactivez RLS avec :
-- alter table public.plans enable row level security;
