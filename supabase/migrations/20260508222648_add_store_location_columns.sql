-- Add geolocation columns to stores table
ALTER TABLE stores 
ADD COLUMN IF NOT EXISTS latitude numeric,
ADD COLUMN IF NOT EXISTS longitude numeric,
ADD COLUMN IF NOT EXISTS city text,
ADD COLUMN IF NOT EXISTS country text DEFAULT 'Gabon',
ADD COLUMN IF NOT EXISTS location_set_at timestamp with time zone;

-- Create index for geospatial searches
CREATE INDEX IF NOT EXISTS idx_stores_location ON stores(latitude, longitude) WHERE latitude IS NOT NULL;