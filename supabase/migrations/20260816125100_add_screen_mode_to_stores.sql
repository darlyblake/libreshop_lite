-- Migration: add_screen_mode_to_stores
-- Adds screen_current_mode and screen_message columns to stores table for BarLiveScreen feature

ALTER TABLE public.stores
ADD COLUMN IF NOT EXISTS screen_current_mode TEXT DEFAULT 'menu',
ADD COLUMN IF NOT EXISTS screen_message TEXT;
