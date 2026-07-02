-- Activer Realtime pour la table notifications
BEGIN;
  -- Remove from publication if it exists to avoid errors, then add it
  ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
EXCEPTION
  WHEN duplicate_object THEN
    NULL;
END;
