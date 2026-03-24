-- Nettoyer et réinitialiser les politiques RLS pour les notifications pour garantir un accès propre.
-- 1. Autoriser l'insertion pour tous (Clients, Invités, Admins).
-- 2. Autoriser la lecture/mise à jour uniquement pour le destinataire (user_id).

-- S'assurer que RLS est actif
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Tout supprimer pour repartir sur de bonnes bases
DROP POLICY IF EXISTS "Allow anyone to insert notifications" ON public.notifications;
DROP POLICY IF EXISTS "Allow authenticated users to insert notifications" ON public.notifications;
DROP POLICY IF EXISTS "Users can view own notifications" ON public.notifications;
DROP POLICY IF EXISTS "Users can update own notifications" ON public.notifications;
DROP POLICY IF EXISTS "Users can delete own notifications" ON public.notifications;
DROP POLICY IF EXISTS "Admins can manage all notifications (metadata role)" ON public.notifications;

-- 1. INSERTION : Tout utilisateur peut créer une notification (ex: client notifie vendeur)
CREATE POLICY "notifications_insert_policy" 
    ON public.notifications 
    FOR INSERT 
    WITH CHECK (true);

-- 2. LECTURE : Seul le destinataire peut voir ses notifications
CREATE POLICY "notifications_select_policy" 
    ON public.notifications 
    FOR SELECT 
    USING (auth.uid() = user_id);

-- 3. MISE À JOUR : Seul le destinataire peut modifier le statut "lu"
CREATE POLICY "notifications_update_policy" 
    ON public.notifications 
    FOR UPDATE 
    USING (auth.uid() = user_id) 
    WITH CHECK (auth.uid() = user_id);

-- 4. SUPPRESSION : Seul le destinataire peut supprimer
CREATE POLICY "notifications_delete_policy" 
    ON public.notifications 
    FOR DELETE 
    USING (auth.uid() = user_id);

-- 5. ADMIN : L'admin peut tout faire
CREATE POLICY "notifications_admin_policy" 
    ON public.notifications 
    FOR ALL 
    USING (
        (auth.jwt() -> 'user_metadata' ->> 'role' = 'admin') OR 
        (auth.jwt() -> 'app_metadata' ->> 'role' = 'admin')
    );
