ALTER TABLE public.savings_goals 
  ADD COLUMN IF NOT EXISTS is_locked boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS interest_rate numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS interest_frequency text DEFAULT 'yearly',
  ADD COLUMN IF NOT EXISTS bank_name text DEFAULT NULL;