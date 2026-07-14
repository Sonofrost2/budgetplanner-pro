
CREATE OR REPLACE FUNCTION public.get_budget_spending(p_user_id uuid, p_category_id uuid, p_type text, p_start_date date, p_end_date date)
RETURNS numeric
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT COALESCE(SUM(amount), 0)
  FROM public.transactions
  WHERE user_id = p_user_id
    AND category_id = p_category_id
    AND type = p_type
    AND is_transfer = false
    AND deleted_at IS NULL
    AND date >= p_start_date
    AND date <= p_end_date;
$function$;

CREATE OR REPLACE FUNCTION public.get_budgets_spending(p_user_id uuid, p_start_date date, p_end_date date)
RETURNS TABLE(category_id uuid, type text, total numeric)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT category_id, type, COALESCE(SUM(amount), 0)
  FROM public.transactions
  WHERE user_id = p_user_id
    AND deleted_at IS NULL
    AND is_transfer = false
    AND category_id IS NOT NULL
    AND date >= p_start_date AND date <= p_end_date
  GROUP BY category_id, type;
$function$;

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
  WHERE user_id = p_user_id
    AND deleted_at IS NULL
    AND is_transfer = false
    AND date >= v_period_start;

  SELECT COALESCE(SUM(current_amount),0) INTO v_savings_total
  FROM public.savings_goals
  WHERE user_id = p_user_id AND deleted_at IS NULL
    AND paused_at IS NULL AND status = 'active';

  SELECT COALESCE(SUM(total_amount - paid_amount),0) INTO v_debt_total
  FROM public.debts WHERE user_id = p_user_id AND deleted_at IS NULL;

  SELECT COUNT(*) INTO v_account_count
  FROM public.payment_accounts
  WHERE user_id = p_user_id AND deleted_at IS NULL
    AND archived_at IS NULL AND status = 'active';

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
