CREATE TABLE IF NOT EXISTS public.store_promos (
    id UUID DEFAULT extensions.uuid_generate_v4() PRIMARY KEY,
    store_id UUID REFERENCES public.stores(id) ON DELETE CASCADE,
    title TEXT,
    subtitle TEXT,
    image_url TEXT NOT NULL,
    target_type TEXT CHECK (target_type IN ('collection', 'product', 'url')),
    target_id UUID,
    target_url TEXT,
    enabled BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS
ALTER TABLE public.store_promos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "store_promos_read_all" ON public.store_promos FOR SELECT USING (true);
CREATE POLICY "store_promos_all_store_owner" ON public.store_promos 
    FOR ALL 
    USING (
        EXISTS (
            SELECT 1 FROM public.stores 
            WHERE stores.id = store_promos.store_id 
            AND stores.user_id = auth.uid()
        )
    );

-- Trigger for updated_at
CREATE TRIGGER handle_updated_at BEFORE UPDATE ON public.store_promos
  FOR EACH ROW EXECUTE PROCEDURE moddatetime (updated_at);
