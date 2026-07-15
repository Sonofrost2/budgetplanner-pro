ALTER TABLE public.savings_goals
  ADD COLUMN IF NOT EXISTS priority smallint NOT NULL DEFAULT 2 CHECK (priority BETWEEN 1 AND 3),
  ADD COLUMN IF NOT EXISTS purpose text NOT NULL DEFAULT 'other' CHECK (purpose IN ('security','project','lifestyle','growth','other')),
  ADD COLUMN IF NOT EXISTS notes text;