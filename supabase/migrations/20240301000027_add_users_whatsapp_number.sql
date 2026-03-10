-- Add WhatsApp number for users (used by admin contact button)

ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS whatsapp_number TEXT;
