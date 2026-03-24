-- Permettre à tout utilisateur authentifié d'insérer des notifications.
-- Ceci est nécessaire car un client (acheteur) crée des notifications pour un vendeur.
-- (Le user_id de la notification = le vendeur, mais auth.uid() = le client).

-- Assurez-vous que RLS est bien activé sur la table
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Création de la politique pour permettre l'insertion
CREATE POLICY "Allow authenticated users to insert notifications" 
    ON public.notifications 
    FOR INSERT 
    WITH CHECK (auth.role() = 'authenticated');
