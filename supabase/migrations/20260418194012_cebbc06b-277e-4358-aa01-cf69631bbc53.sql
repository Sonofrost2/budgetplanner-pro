-- Phase 1: Cycle de vie comptes
ALTER TABLE public.payment_accounts 
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS last_activity_at timestamptz;

-- Backfill last_activity_at from latest transaction
UPDATE public.payment_accounts pa
SET last_activity_at = sub.last_tx
FROM (
  SELECT account_id, MAX(date) AS last_tx
  FROM public.transactions
  WHERE account_id IS NOT NULL AND deleted_at IS NULL
  GROUP BY account_id
) sub
WHERE pa.id = sub.account_id;

CREATE INDEX IF NOT EXISTS idx_payment_accounts_status ON public.payment_accounts(user_id, status) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_payment_accounts_last_activity ON public.payment_accounts(user_id, last_activity_at) WHERE deleted_at IS NULL;

-- Trigger: maintain last_activity_at on transaction insert
CREATE OR REPLACE FUNCTION public.update_account_last_activity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.account_id IS NOT NULL THEN
    UPDATE public.payment_accounts
    SET last_activity_at = GREATEST(COALESCE(last_activity_at, '1970-01-01'::timestamptz), NEW.date::timestamptz)
    WHERE id = NEW.account_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_update_account_last_activity ON public.transactions;
CREATE TRIGGER trg_update_account_last_activity
  AFTER INSERT ON public.transactions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_account_last_activity();

-- Phase 2: Auto-archive savings goals (atteint puis vidé)
CREATE OR REPLACE FUNCTION public.check_savings_completion()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Cas 1: Atteinte de l'objectif → status = completed
  IF NEW.current_amount >= NEW.target_amount 
     AND NEW.target_amount > 0 
     AND NEW.status = 'active'
     AND OLD.current_amount < NEW.target_amount THEN
    NEW.status := 'completed';
  END IF;

  -- Cas 2: Goal completed mais current_amount tombe à <5% du target → auto-archive (réinvesti)
  IF OLD.status = 'completed' 
     AND NEW.status = 'completed'
     AND NEW.current_amount < (NEW.target_amount * 0.05)
     AND OLD.current_amount >= (OLD.target_amount * 0.05) THEN
    NEW.status := 'archived';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_check_savings_completion ON public.savings_goals;
CREATE TRIGGER trg_check_savings_completion
  BEFORE UPDATE ON public.savings_goals
  FOR EACH ROW
  WHEN (OLD.current_amount IS DISTINCT FROM NEW.current_amount)
  EXECUTE FUNCTION public.check_savings_completion();

-- RPC: detect inactive accounts (>90j sans mouvement, status active)
CREATE OR REPLACE FUNCTION public.get_dormant_accounts(p_user_id uuid, p_days integer DEFAULT 90)
RETURNS TABLE(id uuid, name text, icon text, days_inactive integer, real_balance numeric)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    pa.id, pa.name, pa.icon,
    COALESCE(EXTRACT(DAY FROM (now() - pa.last_activity_at))::integer, 9999) AS days_inactive,
    pa.real_balance
  FROM public.payment_accounts pa
  WHERE pa.user_id = p_user_id
    AND pa.deleted_at IS NULL
    AND pa.archived_at IS NULL
    AND pa.status = 'active'
    AND (pa.last_activity_at IS NULL OR pa.last_activity_at < now() - (p_days || ' days')::interval);
$$;

-- RPC: get account stats for drill-down (vélocité, top categories)
CREATE OR REPLACE FUNCTION public.get_account_drilldown(p_user_id uuid, p_account_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result jsonb;
  v_velocity numeric;
  v_avg_amount numeric;
  v_top_cats jsonb;
  v_monthly jsonb;
BEGIN
  -- Vélocité (mvt/mois sur 6 derniers mois)
  SELECT COUNT(*)::numeric / 6.0 INTO v_velocity
  FROM public.transactions
  WHERE account_id = p_account_id 
    AND user_id = p_user_id
    AND deleted_at IS NULL
    AND date >= CURRENT_DATE - interval '6 months';

  SELECT COALESCE(AVG(amount), 0) INTO v_avg_amount
  FROM public.transactions
  WHERE account_id = p_account_id AND user_id = p_user_id AND deleted_at IS NULL;

  -- Top 5 catégories de dépenses
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'category_id', sub.category_id, 'name', sub.name, 'icon', sub.icon, 'total', sub.total
  ) ORDER BY sub.total DESC), '[]'::jsonb) INTO v_top_cats
  FROM (
    SELECT t.category_id, c.name, c.icon, SUM(t.amount) AS total
    FROM public.transactions t
    LEFT JOIN public.categories c ON c.id = t.category_id
    WHERE t.account_id = p_account_id AND t.user_id = p_user_id 
      AND t.type = 'expense' AND t.deleted_at IS NULL
      AND t.date >= CURRENT_DATE - interval '6 months'
    GROUP BY t.category_id, c.name, c.icon
    ORDER BY total DESC LIMIT 5
  ) sub;

  -- Évolution mensuelle 12 mois
  SELECT COALESCE(jsonb_agg(jsonb_build_object('month', m.label, 'income', m.income, 'expense', m.expense) ORDER BY m.ord), '[]'::jsonb) INTO v_monthly
  FROM (
    SELECT 
      to_char(date_trunc('month', t.date), 'YYYY-MM') AS label,
      date_trunc('month', t.date) AS ord,
      COALESCE(SUM(CASE WHEN t.type='income' THEN t.amount END), 0) AS income,
      COALESCE(SUM(CASE WHEN t.type='expense' THEN t.amount END), 0) AS expense
    FROM public.transactions t
    WHERE t.account_id = p_account_id AND t.user_id = p_user_id AND t.deleted_at IS NULL
      AND t.date >= CURRENT_DATE - interval '12 months'
    GROUP BY date_trunc('month', t.date)
  ) m;

  v_result := jsonb_build_object(
    'velocity', ROUND(v_velocity, 1),
    'avg_amount', ROUND(v_avg_amount, 0),
    'top_categories', v_top_cats,
    'monthly_evolution', v_monthly
  );

  RETURN v_result;
END;
$$;