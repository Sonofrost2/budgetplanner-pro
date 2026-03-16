
ALTER TABLE public.budgets ADD COLUMN IF NOT EXISTS reference_date date;
ALTER TABLE public.budgets ADD COLUMN IF NOT EXISTS active_days text;
