ALTER TABLE public.budgets ADD COLUMN budget_type text NOT NULL DEFAULT 'expense';
ALTER TABLE public.budgets ADD COLUMN control_type text NOT NULL DEFAULT 'max';