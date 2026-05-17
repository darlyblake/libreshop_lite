ALTER TABLE stores
ADD COLUMN IF NOT EXISTS announcement_banner text,
ADD COLUMN IF NOT EXISTS announcement_banner_enabled boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS announcement_popup text,
ADD COLUMN IF NOT EXISTS announcement_popup_enabled boolean DEFAULT false;
