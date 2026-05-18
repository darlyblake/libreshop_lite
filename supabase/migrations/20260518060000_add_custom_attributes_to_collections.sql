-- Migration: Add custom_attributes to collections table for advanced customization
-- Target: collections

ALTER TABLE public.collections 
ADD COLUMN IF NOT EXISTS custom_attributes JSONB DEFAULT '[]'::jsonb;
