CREATE TABLE IF NOT EXISTS public.push_tokens (
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    token TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (user_id, token)
);

ALTER TABLE public.push_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert their own push tokens" 
    ON public.push_tokens FOR INSERT 
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view their own push tokens" 
    ON public.push_tokens FOR SELECT 
    USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own push tokens" 
    ON public.push_tokens FOR UPDATE 
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own push tokens" 
    ON public.push_tokens FOR DELETE 
    USING (auth.uid() = user_id);
    
-- Allow service role to view all tokens
CREATE POLICY "Service role can view all tokens" 
    ON public.push_tokens FOR SELECT 
    USING (true);
