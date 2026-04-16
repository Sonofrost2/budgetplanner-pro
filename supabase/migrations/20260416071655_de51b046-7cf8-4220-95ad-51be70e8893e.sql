
-- Add account_id to debts for payment traceability
ALTER TABLE public.debts 
ADD COLUMN account_id uuid REFERENCES public.payment_accounts(id) ON DELETE SET NULL;

-- Add last_capitalized_at to savings_goals to prevent duplicate interest capitalization
ALTER TABLE public.savings_goals
ADD COLUMN last_capitalized_at timestamp with time zone DEFAULT NULL;
