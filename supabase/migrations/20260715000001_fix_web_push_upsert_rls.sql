-- Corriger les politiques RLS pour permettre le UPSERT sur web_push_subscriptions
-- L'erreur 401 venait du fait que la politique n'autorisait que INSERT, pas UPDATE
-- Or l'on utilise on_conflict (UPSERT) qui nécessite aussi une politique UPDATE

DROP POLICY IF EXISTS "Users can insert their own web push subscriptions" ON public.web_push_subscriptions;
DROP POLICY IF EXISTS "Users can update their own web push subscriptions" ON public.web_push_subscriptions;

-- Politique INSERT : un utilisateur ne peut insérer que son propre abonnement
CREATE POLICY "Users can insert their own web push subscriptions"
    ON public.web_push_subscriptions FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- Politique UPDATE : un utilisateur ne peut mettre à jour que son propre abonnement (requis pour le UPSERT)
CREATE POLICY "Users can update their own web push subscriptions"
    ON public.web_push_subscriptions FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);
