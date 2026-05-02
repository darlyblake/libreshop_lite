-- Allow email to be null for anonymous users
ALTER TABLE public.users ALTER COLUMN email DROP NOT NULL;

-- Update RLS policy for insert to ensure users can only insert their own row
-- (already exists but making sure)
DROP POLICY IF EXISTS "Users can insert own profile" ON public.users;
CREATE POLICY "Users can insert own profile" ON public.users 
    FOR INSERT WITH CHECK (auth.uid() = id);
