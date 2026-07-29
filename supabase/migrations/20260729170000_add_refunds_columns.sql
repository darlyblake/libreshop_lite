-- Add missing columns to refunds table
ALTER TABLE public.refunds
ADD COLUMN IF NOT EXISTS type TEXT NOT NULL DEFAULT 'full' CHECK (type IN ('full', 'partial')),
ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'processed')),
ADD COLUMN IF NOT EXISTS items JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS processed_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS processed_by UUID REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS notes TEXT,
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

-- Trigger for updated_at on refunds
DROP TRIGGER IF EXISTS update_refunds_modtime ON public.refunds;
CREATE TRIGGER update_refunds_modtime
    BEFORE UPDATE ON public.refunds
    FOR EACH ROW EXECUTE FUNCTION update_modified_column();
