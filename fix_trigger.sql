CREATE OR REPLACE FUNCTION public.log_user_address_changes()
RETURNS TRIGGER AS $$
DECLARE
  v_action text;
BEGIN
  -- Map TG_OP to valid_action constraint ('create', 'update', 'delete')
  IF TG_OP = 'INSERT' THEN
    v_action := 'create';
  ELSIF TG_OP = 'UPDATE' THEN
    v_action := 'update';
  ELSIF TG_OP = 'DELETE' THEN
    v_action := 'delete';
  END IF;

  INSERT INTO public.user_audit_log (
    user_id,
    action,
    previous_data,
    current_data,
    changed_at,
    changed_by
  ) VALUES (
    COALESCE(NEW.user_id, OLD.user_id),
    v_action,
    CASE WHEN TG_OP IN ('UPDATE', 'DELETE') THEN row_to_json(OLD) ELSE NULL END,
    CASE WHEN TG_OP IN ('INSERT', 'UPDATE') THEN row_to_json(NEW) ELSE NULL END,
    now(),
    auth.uid()
  );
  
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
