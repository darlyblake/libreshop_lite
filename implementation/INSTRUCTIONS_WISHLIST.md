# 🚀 Instructions pour Activer les Favoris

## ⚠️ Problème Actuel
Les favoris ne fonctionnent pas car la table `wishlist` n'existe pas dans Supabase.

## 📋 Étapes pour Créer la Table Wishlist

### 1. Ouvrir Supabase Dashboard
- Allez sur : https://supabase.com/dashboard
- Connectez-vous avec votre compte
- Sélectionnez votre projet `gdjqzhbfibrsdiwvfhvp.supabase.co`

### 2. Accéder au SQL Editor
- Dans le menu de gauche, cliquez sur **"SQL Editor"**
- Cliquez sur **"New query"** pour créer une nouvelle requête

### 3. Copier et Coller le Script
Copiez tout le contenu ci-dessous et collez-le dans l'éditeur SQL :

```sql
-- Script pour créer la table wishlist
CREATE TABLE IF NOT EXISTS public.wishlist (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, product_id)
);

-- Activer RLS (Row Level Security)
ALTER TABLE public.wishlist ENABLE ROW LEVEL SECURITY;

-- Créer les politiques de sécurité
CREATE POLICY "Users can view their own wishlist" ON public.wishlist
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can add to their own wishlist" ON public.wishlist
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete from their own wishlist" ON public.wishlist
  FOR DELETE USING (auth.uid() = user_id);

-- Créer les index pour optimiser les performances
CREATE INDEX IF NOT EXISTS idx_wishlist_user_id ON public.wishlist(user_id);
CREATE INDEX IF NOT EXISTS idx_wishlist_product_id ON public.wishlist(product_id);
CREATE INDEX IF NOT EXISTS idx_wishlist_created_at ON public.wishlist(created_at DESC);

-- Créer un trigger pour mettre à jour updated_at
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER handle_wishlist_updated_at
  BEFORE UPDATE ON public.wishlist
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();
```

### 4. Exécuter le Script
- Cliquez sur le bouton **"Run"** (ou appuyez sur Ctrl+Entrée)
- Attendez que le script s'exécute
- Vous devriez voir "Success" dans la console

### 5. Vérifier la Création
- Allez dans **"Table Editor"** dans le menu
- Vous devriez voir la table `wishlist` dans la liste
- Vous pouvez cliquer dessus pour voir sa structure

## ✅ Une Fait, les Favoris Fonctionnent !

Après avoir exécuté ce script :
- ✅ Les boutons "J'aime" fonctionneront
- ✅ Les favoris seront sauvegardés dans la base de données
- ✅ La page "Mes Favoris" affichera les vrais produits
- ✅ Les favoris persisteront entre les sessions

## 🔧 Si ça ne marche pas

1. **Vérifiez les erreurs** : Regardez la console SQL pour les messages d'erreur
2. **Permissions** : Assurez-vous d'avoir les droits d'admin sur le projet
3. **Contactez** : Si besoin, demandez de l'aide dans les issues du projet

---

## 📱 Test des Favoris

Une fois la table créée :
1. Allez sur la page d'un produit
2. Cliquez sur "J'aime" 
3. Allez dans "Mes Favoris" pour voir le produit
4. Retournez sur la page du produit et cliquez à nouveau pour retirer

**Les favoris seront maintenant complètement fonctionnels !** 🎉
