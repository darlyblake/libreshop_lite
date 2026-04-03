-- Create agent_logs table
CREATE TABLE IF NOT EXISTS agent_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    seller_id UUID REFERENCES users(id) ON DELETE SET NULL,
    question TEXT NOT NULL,
    answer TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Turn on RLS
ALTER TABLE agent_logs ENABLE ROW LEVEL SECURITY;

-- Allow sellers to insert their own logs
CREATE POLICY "Sellers can create their own logs" 
    ON agent_logs FOR INSERT 
    WITH CHECK (auth.uid() = seller_id);

-- Admins can view all logs
CREATE POLICY "Admins can view all agent logs" 
    ON agent_logs FOR SELECT 
    USING (
        EXISTS (
            SELECT 1 FROM users
            WHERE users.id = auth.uid()
            AND users.role = 'admin'
        )
    );
