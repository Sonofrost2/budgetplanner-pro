-- Add archived_at soft-archive column to budgets so users can pause/hide a
-- budget without losing its history. Mirrors the pattern already in use on
-- public.categories (archived_at TIMESTAMPTZ, NULL = active).

ALTER TABLE public.budgets
  ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ NULL;

-- Partial index: most queries filter for active budgets, so index only those.
CREATE INDEX IF NOT EXISTS idx_budgets_user_active
  ON public.budgets (user_id)
  WHERE archived_at IS NULL AND deleted_at IS NULL;