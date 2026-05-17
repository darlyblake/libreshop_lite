-- Migration: Create expenses and refunds tables
-- Created at: 2026-05-16

-- 0. Create update_modified_column function if it doesn't exist
CREATE OR REPLACE FUNCTION update_modified_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- 1. Create Expenses Table
CREATE TABLE IF NOT EXISTS public.expenses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    store_id UUID REFERENCES public.stores(id) ON DELETE CASCADE,
    description TEXT NOT NULL,
    amount DECIMAL(12,2) NOT NULL DEFAULT 0,
    category TEXT NOT NULL, -- e.g., 'Loyer', 'Salaires', 'Marketing', 'Logistique'
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Create Refunds Table
CREATE TABLE IF NOT EXISTS public.refunds (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL,
    store_id UUID REFERENCES public.stores(id) ON DELETE CASCADE,
    amount DECIMAL(12,2) NOT NULL DEFAULT 0,
    reason TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Enable RLS
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.refunds ENABLE ROW LEVEL SECURITY;

-- 4. Policies for Expenses (Sellers can manage their own expenses)
CREATE POLICY "Sellers can manage their own expenses" ON public.expenses
    FOR ALL USING (
        store_id IN (SELECT id FROM public.stores WHERE user_id = auth.uid())
    );

-- 5. Policies for Refunds (Sellers can manage their own refunds)
CREATE POLICY "Sellers can manage their own refunds" ON public.refunds
    FOR ALL USING (
        store_id IN (SELECT id FROM public.stores WHERE user_id = auth.uid())
    );

-- 6. Add trigger for updated_at on expenses
DROP TRIGGER IF EXISTS update_expenses_modtime ON public.expenses;
CREATE TRIGGER update_expenses_modtime
    BEFORE UPDATE ON public.expenses
    FOR EACH ROW EXECUTE FUNCTION update_modified_column();
