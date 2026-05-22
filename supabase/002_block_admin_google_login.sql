-- Fonction pour empêcher la connexion OAuth (Google) pour les administrateurs
CREATE OR REPLACE FUNCTION public.prevent_admin_google_login()
RETURNS TRIGGER AS $$
DECLARE
  user_role text;
BEGIN
  -- Récupérer le rôle de l'utilisateur qui tente de s'authentifier
  SELECT raw_user_meta_data->>'role' INTO user_role 
  FROM auth.users 
  WHERE id = NEW.user_id;

  -- Si l'utilisateur est un admin et que le fournisseur d'identité est google, on rejette !
  IF user_role = 'admin' AND NEW.provider = 'google' THEN
    RAISE EXCEPTION 'Les administrateurs ne peuvent se connecter que par email et mot de passe pour des raisons de sécurité.';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Créer le trigger sur la table auth.identities qui gère les fournisseurs de connexion
DROP TRIGGER IF EXISTS block_admin_google_identity ON auth.identities;
CREATE TRIGGER block_admin_google_identity
BEFORE INSERT OR UPDATE ON auth.identities
FOR EACH ROW EXECUTE FUNCTION public.prevent_admin_google_login();
