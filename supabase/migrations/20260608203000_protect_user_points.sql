-- ============================================================
-- SECURITY HARDENING: Protect user points from client-side tampering
-- ============================================================

-- Function to prevent users from modifying their own points directly
CREATE OR REPLACE FUNCTION public.protect_user_points()
RETURNS TRIGGER AS $$
BEGIN
  -- Si la modification ne vient pas d'un super-administrateur (postgres) 
  -- et que la valeur des points a changé
  IF current_setting('role') = 'authenticated' THEN
    -- On force la nouvelle valeur à rester l'ancienne
    -- Seules les fonctions SECURITY DEFINER ou les admins pourront modifier les points
    NEW.points = OLD.points;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create the trigger on the users table
DROP TRIGGER IF EXISTS tr_protect_user_points ON public.users;
CREATE TRIGGER tr_protect_user_points
  BEFORE UPDATE ON public.users
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_user_points();
