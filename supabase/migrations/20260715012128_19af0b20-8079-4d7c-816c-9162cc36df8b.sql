ALTER TABLE public.savings_goals
  ADD COLUMN IF NOT EXISTS contribution_frequency text NOT NULL DEFAULT 'monthly'
  CHECK (contribution_frequency IN ('weekly','biweekly','monthly','quarterly'));