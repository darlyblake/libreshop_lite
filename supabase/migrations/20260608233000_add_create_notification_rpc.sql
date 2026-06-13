-- Function to allow system to create notifications for users bypassing RLS
-- Uses SECURITY DEFINER so a seller can create a notification for a client
CREATE OR REPLACE FUNCTION create_system_notification(
  p_user_id UUID,
  p_title TEXT,
  p_body TEXT,
  p_type TEXT DEFAULT 'system',
  p_target_role TEXT DEFAULT 'client',
  p_data JSONB DEFAULT '{}'::jsonb
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_notification JSONB;
  v_valid_type TEXT;
BEGIN
  -- Normalize type to match CHECK constraint: ('order', 'payment', 'promo', 'system')
  IF p_type IN ('order', 'payment', 'promo', 'system') THEN
    v_valid_type := p_type;
  ELSE
    v_valid_type := 'system';
  END IF;

  INSERT INTO public.notifications (user_id, title, body, type, "data", read, created_at)
  VALUES (p_user_id, p_title, p_body, v_valid_type, jsonb_build_object('targetRole', p_target_role) || p_data, false, now())
  RETURNING to_jsonb(notifications.*) INTO v_notification;
  
  RETURN v_notification;
END;
$$;
