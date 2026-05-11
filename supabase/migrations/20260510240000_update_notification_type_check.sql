-- Update the CHECK constraint on type column to include new notification types
ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS notifications_type_check;
ALTER TABLE public.notifications ADD CONSTRAINT notifications_type_check 
  CHECK (type IN ('order', 'payment', 'promo', 'system', 'comment', 'like', 'admin'));
