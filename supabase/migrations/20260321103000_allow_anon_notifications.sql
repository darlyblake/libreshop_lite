-- Permettre à tout utilisateur (même non-connecté / anon) d'insérer des notifications.
-- Important pour le mode "Invité" lors des commandes.
DROP POLICY IF EXISTS "Allow authenticated users to insert notifications" ON public.notifications;
CREATE POLICY "Allow anyone to insert notifications" 
    ON public.notifications 
    FOR INSERT 
    WITH CHECK (true);

-- S'assurer que les utilisateurs ne peuvent voir que leurs propres notifications
-- (Déjà existant mais on le réaffirme pour la clarté)
DROP POLICY IF EXISTS "Users can view own notifications" ON public.notifications;
CREATE POLICY "Users can view own notifications"
    ON public.notifications
    FOR SELECT
    TO authenticated
    USING (auth.uid() = user_id);
