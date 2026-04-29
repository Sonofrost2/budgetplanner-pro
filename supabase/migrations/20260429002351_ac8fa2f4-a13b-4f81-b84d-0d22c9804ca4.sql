-- =========================================================================
-- Synchronisation Transactions ↔ Savings Goals (via budget lié)
-- Quand une transaction est créée/modifiée/supprimée et que sa catégorie
-- correspond à un budget lié à un objectif d'épargne :
--   - expense  → augmente current_amount (alimente l'épargne)
--   - income   → diminue current_amount (retrait de l'épargne)
--   - transfer → ignoré (les transferts n'affectent pas la consommation budget)
-- =========================================================================

CREATE OR REPLACE FUNCTION public.sync_savings_from_transaction()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_old_goal_id uuid;
  v_new_goal_id uuid;
  v_old_delta numeric := 0;
  v_new_delta numeric := 0;
BEGIN
  -- Helper inline: trouver le goal lié à la catégorie de la transaction
  -- via budgets.linked_savings_goal_id
  
  -- OLD side (UPDATE / DELETE)
  IF (TG_OP = 'UPDATE' OR TG_OP = 'DELETE') THEN
    IF OLD.category_id IS NOT NULL AND OLD.deleted_at IS NULL AND OLD.type IN ('expense','income') THEN
      SELECT b.linked_savings_goal_id INTO v_old_goal_id
      FROM public.budgets b
      WHERE b.category_id = OLD.category_id
        AND b.user_id = OLD.user_id
        AND b.linked_savings_goal_id IS NOT NULL
        AND b.deleted_at IS NULL
      LIMIT 1;

      IF v_old_goal_id IS NOT NULL THEN
        v_old_delta := CASE WHEN OLD.type = 'expense' THEN OLD.amount ELSE -OLD.amount END;
      END IF;
    END IF;
  END IF;

  -- NEW side (INSERT / UPDATE)
  IF (TG_OP = 'INSERT' OR TG_OP = 'UPDATE') THEN
    IF NEW.category_id IS NOT NULL AND NEW.deleted_at IS NULL AND NEW.type IN ('expense','income') THEN
      SELECT b.linked_savings_goal_id INTO v_new_goal_id
      FROM public.budgets b
      WHERE b.category_id = NEW.category_id
        AND b.user_id = NEW.user_id
        AND b.linked_savings_goal_id IS NOT NULL
        AND b.deleted_at IS NULL
      LIMIT 1;

      IF v_new_goal_id IS NOT NULL THEN
        v_new_delta := CASE WHEN NEW.type = 'expense' THEN NEW.amount ELSE -NEW.amount END;
      END IF;
    END IF;
  END IF;

  -- Apply deltas (revert OLD, apply NEW)
  IF v_old_goal_id IS NOT NULL AND v_old_delta <> 0 THEN
    UPDATE public.savings_goals
    SET current_amount = GREATEST(0, COALESCE(current_amount, 0) - v_old_delta),
        updated_at = now()
    WHERE id = v_old_goal_id;
  END IF;

  IF v_new_goal_id IS NOT NULL AND v_new_delta <> 0 THEN
    UPDATE public.savings_goals
    SET current_amount = GREATEST(0, COALESCE(current_amount, 0) + v_new_delta),
        updated_at = now()
    WHERE id = v_new_goal_id;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_savings_from_transaction ON public.transactions;
CREATE TRIGGER trg_sync_savings_from_transaction
AFTER INSERT OR UPDATE OR DELETE ON public.transactions
FOR EACH ROW
EXECUTE FUNCTION public.sync_savings_from_transaction();

-- =========================================================================
-- Réconciliation initiale : recalcule current_amount pour chaque objectif
-- lié à un budget, basé sur les transactions existantes (expense - income)
-- dans la catégorie du budget lié.
-- =========================================================================

WITH linked AS (
  SELECT
    sg.id AS goal_id,
    sg.user_id,
    b.category_id
  FROM public.savings_goals sg
  JOIN public.budgets b
    ON b.linked_savings_goal_id = sg.id
   AND b.deleted_at IS NULL
  WHERE sg.deleted_at IS NULL
),
sums AS (
  SELECT
    l.goal_id,
    COALESCE(SUM(
      CASE WHEN t.type = 'expense' THEN t.amount
           WHEN t.type = 'income' THEN -t.amount
           ELSE 0 END
    ), 0) AS computed
  FROM linked l
  LEFT JOIN public.transactions t
    ON t.user_id = l.user_id
   AND t.category_id = l.category_id
   AND t.deleted_at IS NULL
   AND t.type IN ('expense','income')
  GROUP BY l.goal_id
)
UPDATE public.savings_goals sg
SET current_amount = GREATEST(0, s.computed),
    updated_at = now()
FROM sums s
WHERE sg.id = s.goal_id;