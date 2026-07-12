-- ============================================================
-- Migration: Finaliser la table store_promos
-- Description: Crée ou consolide la table store_promos avec
--              toutes les policies RLS nécessaires.
-- ============================================================

-- 1. Créer la table si elle n'existe pas encore
CREATE TABLE IF NOT EXISTS public.store_promos (
    id UUID DEFAULT extensions.uuid_generate_v4() PRIMARY KEY,
    store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
    title TEXT,
    subtitle TEXT,
    image_url TEXT NOT NULL,
    target_type TEXT CHECK (target_type IN ('collection', 'product', 'url')),
    target_id UUID,         -- ID collection ou produit
    target_url TEXT,        -- URL externe si target_type = 'url'
    enabled BOOLEAN DEFAULT true,
    sort_order INTEGER DEFAULT 0,  -- pour ordonner les bannières (0 = première)
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Ajouter la colonne sort_order si elle manque (idempotent)
ALTER TABLE public.store_promos 
    ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0;

-- 3. Activer RLS
ALTER TABLE public.store_promos ENABLE ROW LEVEL SECURITY;

-- 4. Supprimer les anciennes policies si elles existent (pour éviter les conflits)
DROP POLICY IF EXISTS "store_promos_read_all" ON public.store_promos;
DROP POLICY IF EXISTS "store_promos_all_store_owner" ON public.store_promos;
DROP POLICY IF EXISTS "store_promos_select_public" ON public.store_promos;
DROP POLICY IF EXISTS "store_promos_insert_owner" ON public.store_promos;
DROP POLICY IF EXISTS "store_promos_update_owner" ON public.store_promos;
DROP POLICY IF EXISTS "store_promos_delete_owner" ON public.store_promos;

-- 5. Recreer les policies proprement (lecture publique, écriture propriétaire)
CREATE POLICY "store_promos_select_public"
    ON public.store_promos FOR SELECT
    USING (true);  -- N'importe qui peut lire les bannières d'une boutique

CREATE POLICY "store_promos_insert_owner"
    ON public.store_promos FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.stores
            WHERE stores.id = store_promos.store_id
            AND stores.user_id = auth.uid()
        )
    );

CREATE POLICY "store_promos_update_owner"
    ON public.store_promos FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM public.stores
            WHERE stores.id = store_promos.store_id
            AND stores.user_id = auth.uid()
        )
    );

CREATE POLICY "store_promos_delete_owner"
    ON public.store_promos FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM public.stores
            WHERE stores.id = store_promos.store_id
            AND stores.user_id = auth.uid()
        )
    );

-- 6. Index pour performance (chercher les promos d'une boutique)
CREATE INDEX IF NOT EXISTS idx_store_promos_store_id ON public.store_promos(store_id);
CREATE INDEX IF NOT EXISTS idx_store_promos_enabled ON public.store_promos(store_id, enabled);

-- 7. Trigger pour updated_at automatique (sans extension moddatetime)
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS handle_updated_at ON public.store_promos;
CREATE TRIGGER handle_updated_at
    BEFORE UPDATE ON public.store_promos
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
