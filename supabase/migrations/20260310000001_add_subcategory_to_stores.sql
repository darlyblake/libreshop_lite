-- Add subcategory column to stores table
ALTER TABLE public.stores 
ADD COLUMN IF NOT EXISTS subcategory TEXT;
