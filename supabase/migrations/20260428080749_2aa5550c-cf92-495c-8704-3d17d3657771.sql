-- 1. Add link columns
ALTER TABLE public.budgets
  ADD COLUMN IF NOT EXISTS linked_savings_goal_id uuid REFERENCES public.savings_goals(id) ON DELETE SET NULL;

ALTER TABLE public.savings_goals
  ADD COLUMN IF NOT EXISTS linked_budget_id uuid REFERENCES public.budgets(id) ON DELETE SET NULL;

-- 2. Indexes (partial)
CREATE INDEX IF NOT EXISTS idx_budgets_linked_savings_goal
  ON public.budgets(linked_savings_goal_id)
  WHERE linked_savings_goal_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_savings_goals_linked_budget
  ON public.savings_goals(linked_budget_id)
  WHERE linked_budget_id IS NOT NULL;

-- 3. Bidirectional sync trigger — when one side links to the other,
--    mirror the link back AND copy missing parameters
CREATE OR REPLACE FUNCTION public.sync_budget_savings_link()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_TABLE_NAME = 'budgets' THEN
    -- A budget points to a savings goal: mirror the back-reference + copy params
    IF NEW.linked_savings_goal_id IS NOT NULL THEN
      UPDATE public.savings_goals
        SET linked_budget_id = NEW.id,
            monthly_contribution = COALESCE(NULLIF(monthly_contribution, 0), NEW.amount),
            contribution_day = COALESCE(contribution_day, NEW.expected_day),
            start_date = COALESCE(start_date, NEW.reference_date)
      WHERE id = NEW.linked_savings_goal_id
        AND user_id = NEW.user_id
        AND (linked_budget_id IS DISTINCT FROM NEW.id
             OR (monthly_contribution IS NULL OR monthly_contribution = 0)
             OR contribution_day IS NULL
             OR start_date IS NULL);
    END IF;

    -- Cleared link: clear the back-reference too
    IF TG_OP = 'UPDATE'
       AND OLD.linked_savings_goal_id IS NOT NULL
       AND NEW.linked_savings_goal_id IS NULL THEN
      UPDATE public.savings_goals
        SET linked_budget_id = NULL
      WHERE id = OLD.linked_savings_goal_id
        AND linked_budget_id = OLD.id;
    END IF;

  ELSIF TG_TABLE_NAME = 'savings_goals' THEN
    -- A savings goal points to a budget: mirror + copy
    IF NEW.linked_budget_id IS NOT NULL THEN
      UPDATE public.budgets
        SET linked_savings_goal_id = NEW.id,
            amount = CASE WHEN amount IS NULL OR amount = 0 THEN COALESCE(NEW.monthly_contribution, amount) ELSE amount END,
            expected_day = COALESCE(expected_day, NEW.contribution_day),
            reference_date = COALESCE(reference_date, NEW.start_date)
      WHERE id = NEW.linked_budget_id
        AND user_id = NEW.user_id
        AND (linked_savings_goal_id IS DISTINCT FROM NEW.id
             OR expected_day IS NULL
             OR reference_date IS NULL);
    END IF;

    IF TG_OP = 'UPDATE'
       AND OLD.linked_budget_id IS NOT NULL
       AND NEW.linked_budget_id IS NULL THEN
      UPDATE public.budgets
        SET linked_savings_goal_id = NULL
      WHERE id = OLD.linked_budget_id
        AND linked_savings_goal_id = OLD.id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_budget_savings_link ON public.budgets;
CREATE TRIGGER trg_sync_budget_savings_link
  AFTER INSERT OR UPDATE OF linked_savings_goal_id ON public.budgets
  FOR EACH ROW EXECUTE FUNCTION public.sync_budget_savings_link();

DROP TRIGGER IF EXISTS trg_sync_savings_budget_link ON public.savings_goals;
CREATE TRIGGER trg_sync_savings_budget_link
  AFTER INSERT OR UPDATE OF linked_budget_id ON public.savings_goals
  FOR EACH ROW EXECUTE FUNCTION public.sync_budget_savings_link();