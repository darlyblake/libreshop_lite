-- Create OTPs table if it doesn't exist
-- This migration creates the table and sets up secure RLS policies

CREATE TABLE IF NOT EXISTS public.otps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  code_hash text NOT NULL,
  expires_at timestamptz NOT NULL,
  used boolean NOT NULL DEFAULT false,
  attempts integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS otps_email_idx ON public.otps (email);
CREATE INDEX IF NOT EXISTS otps_expires_idx ON public.otps (expires_at);
CREATE INDEX IF NOT EXISTS otps_email_code_hash_idx ON public.otps (email, code_hash);

-- Enable RLS
ALTER TABLE public.otps ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any
DROP POLICY IF EXISTS "Public can insert OTPs" ON public.otps;
DROP POLICY IF EXISTS "Public can update OTPs" ON public.otps;
DROP POLICY IF EXISTS "Public can select OTPs" ON public.otps;

-- Policy: Allow anyone to insert OTPs (for password reset flow)
CREATE POLICY "Allow public OTP insertion"
ON public.otps
FOR INSERT
TO anon, authenticated
WITH CHECK (true);

-- Policy: Allow authenticated users to update OTPs (mark as used)
CREATE POLICY "Allow authenticated OTP update"
ON public.otps
FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

-- Policy: Allow authenticated users to select OTPs (for verification)
CREATE POLICY "Allow authenticated OTP selection"
ON public.otps
FOR SELECT
TO authenticated
USING (true);

-- Policy: Allow service role to manage all OTPs (for admin operations)
CREATE POLICY "Service role full access"
ON public.otps
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);
