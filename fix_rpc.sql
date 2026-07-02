CREATE OR REPLACE FUNCTION update_user_profile_versioned(
  p_user_id uuid,
  p_updates jsonb,
  p_expected_version int DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  email text,
  full_name text,
  phone text,
  avatar_url text,
  whatsapp_number text,
  status text,
  role text,
  version int,
  is_active boolean,
  updated_at timestamp
) AS $$
DECLARE
  v_current_version int;
BEGIN
  IF p_expected_version IS NOT NULL THEN
    SELECT users.version INTO v_current_version
    FROM users
    WHERE users.id = p_user_id AND users.is_active = true
    FOR UPDATE; 
    
    IF v_current_version != p_expected_version THEN
      RETURN;
    END IF;
  END IF;

  RETURN QUERY
  UPDATE users
  SET
    full_name = COALESCE((p_updates->>'full_name'), users.full_name),
    phone = COALESCE((p_updates->>'phone'), users.phone),
    avatar_url = COALESCE((p_updates->>'avatar_url'), users.avatar_url),
    whatsapp_number = COALESCE((p_updates->>'whatsapp_number'), users.whatsapp_number),
    status = COALESCE((p_updates->>'status'), users.status),
    version = COALESCE(users.version, 0) + 1,
    updated_at = NOW()
  WHERE users.id = p_user_id AND users.is_active = true
  RETURNING
    users.id,
    users.email,
    users.full_name,
    users.phone,
    users.avatar_url,
    users.whatsapp_number,
    users.status,
    users.role,
    users.version,
    users.is_active,
    users.updated_at;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
