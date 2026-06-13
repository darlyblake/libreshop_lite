-- Corriger les politiques RLS pour web_push_subscriptions
-- Permettre aux utilisateurs authentifiés d'insérer leurs propres abonnements

DROP POLICY IF EXISTS "Users can insert their own web push subscriptions" ON public.web_push_subscriptions;

CREATE POLICY "Users can insert their own web push subscriptions"
    ON public.web_push_subscriptions FOR INSERT
    WITH CHECK (auth.uid() = user_id);
