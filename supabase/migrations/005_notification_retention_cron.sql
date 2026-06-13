-- Fonction sécurisée pour nettoyer les notifications
CREATE OR REPLACE FUNCTION public.clean_old_notifications()
RETURNS void
LANGUAGE sql
SECURITY DEFINER -- Permet à la fonction de s'exécuter avec les droits de contournement du RLS
AS $$
  -- Supprime les notifications non lues vieilles de plus de 30 jours
  -- ET supprime les notifications lues vieilles de plus de 15 jours
  DELETE FROM public.notifications 
  WHERE (read = false AND created_at < NOW() - INTERVAL '30 days')
     OR (read = true AND created_at < NOW() - INTERVAL '15 days');
$$;

-- Activation de l'extension pg_cron (nécessaire pour la planification)
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;

-- On déschedule au cas où une ancienne tâche du même nom existe déjà
DO $$
BEGIN
  PERFORM cron.unschedule('purge-old-notifications');
EXCEPTION WHEN OTHERS THEN
  -- Ignore l'erreur si la tâche n'existe pas encore
END;
$$;

-- Création de la tâche cron : s'exécute tous les jours à 03h00 du matin (heure serveur)
SELECT cron.schedule(
  'purge-old-notifications',
  '0 3 * * *', 
  'SELECT public.clean_old_notifications();'
);
