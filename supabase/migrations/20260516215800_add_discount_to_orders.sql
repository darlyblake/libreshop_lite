-- Migration: Add discount fields to orders table

ALTER TABLE public.orders 
ADD COLUMN IF NOT EXISTS discount_amount DECIMAL(10, 2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS coupon_code VARCHAR(50);

-- Mettre à jour les politiques si nécessaire (bien que les politiques existantes sur orders suffisent généralement)
