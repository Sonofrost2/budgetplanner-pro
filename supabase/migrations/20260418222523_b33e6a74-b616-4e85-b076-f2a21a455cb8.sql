-- ─── Savings consistency hardening ─────────────────────────────────────────
-- Goal: completed/archived/paused goals AND archived accounts must NEVER inflate
-- the savings totals, the health score, the diversification index, or any
-- cross-module KPI. Source of truth = a single SQL definition of "active goal".

-- 1. Recompute health score with the new active-only rule
CREATE OR REPLACE FUNCTION public.compute_health_score(p_user_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_income numeric := 0;
  v_expense numeric := 0;
  v_savings_total numeric := 0;
  v_debt_total numeric := 0;
  v_account_count integer := 0;
  v_savings_rate numeric := 0;
  v_debt_ratio numeric := 0;
  v_diversification numeric := 0;
  v_score integer := 0;
  v_period_start date := date_trunc('month', CURRENT_DATE - interval '3 months')::date;
BEGIN
  SELECT 
    COALESCE(SUM(CASE WHEN type='income' THEN amount END),0),
    COALESCE(SUM(CASE WHEN type='expense' THEN amount END),0)
  INTO v_income, v_expense
  FROM public.transactions
  WHERE user_id = p_user_id AND deleted_at IS NULL AND date >= v_period_start;

  -- Active goals only (exclude completed/archived/paused) — no artificial inflation
  SELECT COALESCE(SUM(current_amount),0) INTO v_savings_total
  FROM public.savings_goals
  WHERE user_id = p_user_id
    AND deleted_at IS NULL
    AND paused_at IS NULL
    AND status = 'active';

  SELECT COALESCE(SUM(total_amount - paid_amount),0) INTO v_debt_total
  FROM public.debts WHERE user_id = p_user_id AND deleted_at IS NULL;

  -- Active accounts only (exclude archived) for diversification
  SELECT COUNT(*) INTO v_account_count
  FROM public.payment_accounts
  WHERE user_id = p_user_id
    AND deleted_at IS NULL
    AND archived_at IS NULL
    AND status = 'active';

  IF v_income > 0 THEN
    v_savings_rate := LEAST(100, ((v_income - v_expense) / v_income) * 100);
    v_debt_ratio := LEAST(100, GREATEST(0, 100 - (v_debt_total / NULLIF(v_income, 0)) * 25));
  END IF;

  v_diversification := LEAST(100, v_account_count * 20);

  v_score := GREATEST(0, LEAST(100, ROUND(
    (v_savings_rate * 0.35) +
    (v_debt_ratio * 0.30) +
    (v_diversification * 0.15) +
    (CASE WHEN v_savings_total > 0 THEN 20 ELSE 0 END)
  )::int));

  RETURN jsonb_build_object(
    'score', v_score,
    'income_3m', v_income,
    'expense_3m', v_expense,
    'savings_total', v_savings_total,
    'debt_total', v_debt_total,
    'savings_rate', ROUND(v_savings_rate::numeric, 1),
    'debt_ratio', ROUND(v_debt_ratio::numeric, 1),
    'account_count', v_account_count
  );
END;
$function$;

-- 2. Goal completion trigger: when a goal is marked completed, auto-archive its
--    linked payment_account so it stops appearing in the active accounts list,
--    in budgets, in diversification, and in net-worth widgets.
CREATE OR REPLACE FUNCTION public.check_savings_completion()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Cas 1: target reached → status = completed (only on the transition)
  IF NEW.current_amount >= NEW.target_amount
     AND NEW.target_amount > 0
     AND NEW.status = 'active'
     AND OLD.current_amount < NEW.target_amount THEN
    NEW.status := 'completed';
  END IF;

  -- Cas 2: completed goal drained to <5% → auto-archive (réinvesti)
  IF OLD.status = 'completed'
     AND NEW.status = 'completed'
     AND NEW.current_amount < (NEW.target_amount * 0.05)
     AND OLD.current_amount >= (OLD.target_amount * 0.05) THEN
    NEW.status := 'archived';
  END IF;

  -- Cas 3: when transitioning to completed/archived, auto-archive linked account
  IF NEW.status IN ('completed', 'archived')
     AND OLD.status = 'active'
     AND NEW.account_id IS NOT NULL THEN
    UPDATE public.payment_accounts
    SET archived_at = now(),
        status = 'archived',
        updated_at = now()
    WHERE id = NEW.account_id
      AND user_id = NEW.user_id
      AND archived_at IS NULL;
  END IF;

  RETURN NEW;
END;
$function$;

-- Make sure the trigger is attached (idempotent)
DROP TRIGGER IF EXISTS trg_check_savings_completion ON public.savings_goals;
CREATE TRIGGER trg_check_savings_completion
  BEFORE UPDATE ON public.savings_goals
  FOR EACH ROW
  EXECUTE FUNCTION public.check_savings_completion();

-- 3. Performance indexes for the new active-filter queries
CREATE INDEX IF NOT EXISTS idx_savings_goals_active
  ON public.savings_goals (user_id)
  WHERE deleted_at IS NULL AND paused_at IS NULL AND status = 'active';

CREATE INDEX IF NOT EXISTS idx_payment_accounts_active
  ON public.payment_accounts (user_id)
  WHERE deleted_at IS NULL AND archived_at IS NULL AND status = 'active';
