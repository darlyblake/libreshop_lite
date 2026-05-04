-- Create OTPs table for password reset flow
CREATE TABLE IF NOT EXISTS public.otps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  code_hash text NOT NULL,
  expires_at timestamptz NOT NULL,
  used boolean NOT NULL DEFAULT false,
  attempts integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS otps_email_idx ON public.otps (email);
CREATE INDEX IF NOT EXISTS otps_expires_idx ON public.otps (expires_at);
