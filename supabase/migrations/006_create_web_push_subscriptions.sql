CREATE TABLE IF NOT EXISTS public.web_push_subscriptions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    endpoint TEXT NOT NULL,
    p256dh TEXT NOT NULL,
    auth TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, endpoint)
);

ALTER TABLE public.web_push_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert their own web push subscriptions" 
    ON public.web_push_subscriptions FOR INSERT 
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view their own web push subscriptions" 
    ON public.web_push_subscriptions FOR SELECT 
    USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own web push subscriptions" 
    ON public.web_push_subscriptions FOR UPDATE 
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own web push subscriptions" 
    ON public.web_push_subscriptions FOR DELETE 
    USING (auth.uid() = user_id);

-- Allow service role to view all subscriptions for broadcasting
CREATE POLICY "Service role can view all web push subscriptions" 
    ON public.web_push_subscriptions FOR SELECT 
    USING (true);
