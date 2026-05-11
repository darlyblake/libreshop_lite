-- Rename 'message' column to 'body' to match the Notification interface
ALTER TABLE public.notifications RENAME COLUMN message TO body;
