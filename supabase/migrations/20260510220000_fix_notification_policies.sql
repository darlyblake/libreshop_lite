-- Fix RLS policies for notifications to allow admins to insert for other users
DROP POLICY IF EXISTS "Users can insert own notifications" ON public.notifications;
DROP POLICY IF EXISTS "Admins can insert notifications" ON public.notifications;

-- Allow authenticated users to insert their own notifications
CREATE POLICY "Users can insert own notifications" ON public.notifications FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Allow admins to insert notifications for any user
CREATE POLICY "Admins can insert notifications for any user" ON public.notifications FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users 
      WHERE id = auth.uid() 
      AND role = 'admin'
    )
  );

-- Also allow service role to insert
GRANT ALL ON public.notifications TO service_role;
