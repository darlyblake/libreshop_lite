ALTER TABLE public.stores
ADD COLUMN IF NOT EXISTS business_hours JSONB DEFAULT '{"monday":{"isOpen":true,"open":"08:00","close":"18:00"},"tuesday":{"isOpen":true,"open":"08:00","close":"18:00"},"wednesday":{"isOpen":true,"open":"08:00","close":"18:00"},"thursday":{"isOpen":true,"open":"08:00","close":"18:00"},"friday":{"isOpen":true,"open":"08:00","close":"18:00"},"saturday":{"isOpen":true,"open":"09:00","close":"15:00"},"sunday":{"isOpen":false,"open":"00:00","close":"00:00"}}'::jsonb,
ADD COLUMN IF NOT EXISTS is_paused BOOLEAN DEFAULT false;
