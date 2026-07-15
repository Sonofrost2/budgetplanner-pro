
-- P2 — Enrichissement épargne : solde initial, renouvellement, capitalisation

-- Colonnes nouvelles
ALTER TABLE public.savings_goals
  ADD COLUMN IF NOT EXISTS opening_balance NUMERIC NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS is_renewable BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS renewal_frequency TEXT NOT NULL DEFAULT 'yearly'
    CHECK (renewal_frequency IN ('monthly','quarterly','semi_annual','yearly')),
  ADD COLUMN IF NOT EXISTS last_renewed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS renewal_count INTEGER NOT NULL DEFAULT 0;

-- Fonction de capitalisation périodique
-- Crédite les intérêts composés au taux périodique (rate/frequency) sur les
-- objectifs actifs non pausés/supprimés dont la période de capitalisation est
-- échue. Enregistre chaque crédit dans savings_goal_transactions (kind='interest').
CREATE OR REPLACE FUNCTION public.capitalize_savings_interest()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_goal RECORD;
  v_periods_per_year INTEGER;
  v_period_interval INTERVAL;
  v_periodic_rate NUMERIC;
  v_since TIMESTAMPTZ;
  v_periods_elapsed INTEGER;
  v_new_amount NUMERIC;
  v_interest NUMERIC;
  v_count INTEGER := 0;
  v_total NUMERIC := 0;
BEGIN
  FOR v_goal IN
    SELECT * FROM public.savings_goals
      WHERE status = 'active'
        AND deleted_at IS NULL
        AND paused_at IS NULL
        AND COALESCE(interest_rate, 0) > 0
        AND current_amount > 0
  LOOP
    v_periods_per_year := CASE COALESCE(v_goal.interest_frequency, 'yearly')
      WHEN 'daily' THEN 365
      WHEN 'weekly' THEN 52
      WHEN 'monthly' THEN 12
      WHEN 'quarterly' THEN 4
      WHEN 'semi_annual' THEN 2
      ELSE 1
    END;
    v_period_interval := CASE COALESCE(v_goal.interest_frequency, 'yearly')
      WHEN 'daily' THEN INTERVAL '1 day'
      WHEN 'weekly' THEN INTERVAL '7 days'
      WHEN 'monthly' THEN INTERVAL '1 month'
      WHEN 'quarterly' THEN INTERVAL '3 months'
      WHEN 'semi_annual' THEN INTERVAL '6 months'
      ELSE INTERVAL '1 year'
    END;

    v_since := COALESCE(v_goal.last_capitalized_at, v_goal.created_at);
    v_periods_elapsed := FLOOR(EXTRACT(EPOCH FROM (now() - v_since)) / EXTRACT(EPOCH FROM v_period_interval))::INTEGER;
    IF v_periods_elapsed < 1 THEN CONTINUE; END IF;

    -- taux périodique = taux annuel / nb périodes (approximation standard)
    v_periodic_rate := (v_goal.interest_rate / 100.0) / v_periods_per_year;
    v_new_amount := ROUND(v_goal.current_amount * POWER(1 + v_periodic_rate, v_periods_elapsed), 2);
    v_interest := v_new_amount - v_goal.current_amount;
    IF v_interest <= 0 THEN CONTINUE; END IF;

    UPDATE public.savings_goals
      SET current_amount = v_new_amount,
          last_capitalized_at = v_since + (v_periods_elapsed * v_period_interval),
          updated_at = now()
      WHERE id = v_goal.id;

    INSERT INTO public.savings_goal_transactions
      (goal_id, user_id, kind, amount, note)
      VALUES (v_goal.id, v_goal.user_id, 'interest', v_interest,
              'Capitalisation ' || v_periods_elapsed || ' période(s)');

    v_count := v_count + 1;
    v_total := v_total + v_interest;
  END LOOP;

  RETURN jsonb_build_object('goals_credited', v_count, 'total_interest', v_total);
END;
$$;

REVOKE ALL ON FUNCTION public.capitalize_savings_interest() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.capitalize_savings_interest() TO service_role;

-- Fonction de renouvellement d'objectifs récurrents
-- Quand un objectif renouvelable a atteint sa deadline OU son échéance de renouvellement,
-- on archive l'ancien et on en clone un nouveau (mêmes cible/cotisation, current_amount=0).
CREATE OR REPLACE FUNCTION public.renew_savings_goals()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_goal RECORD;
  v_next_deadline DATE;
  v_period_interval INTERVAL;
  v_count INTEGER := 0;
BEGIN
  FOR v_goal IN
    SELECT * FROM public.savings_goals
      WHERE is_renewable = true
        AND deleted_at IS NULL
        AND paused_at IS NULL
        AND status IN ('active','completed')
        AND (
          (deadline IS NOT NULL AND deadline <= CURRENT_DATE)
          OR (status = 'completed')
        )
  LOOP
    v_period_interval := CASE v_goal.renewal_frequency
      WHEN 'monthly' THEN INTERVAL '1 month'
      WHEN 'quarterly' THEN INTERVAL '3 months'
      WHEN 'semi_annual' THEN INTERVAL '6 months'
      ELSE INTERVAL '1 year'
    END;
    v_next_deadline := (COALESCE(v_goal.deadline, CURRENT_DATE) + v_period_interval)::DATE;

    -- Archive l'ancien
    UPDATE public.savings_goals
      SET status = 'archived', updated_at = now()
      WHERE id = v_goal.id;

    -- Crée le nouveau cycle
    INSERT INTO public.savings_goals (
      user_id, name, target_amount, icon, deadline, account_id,
      monthly_contribution, start_date, contribution_day, is_locked,
      interest_rate, interest_frequency, bank_name, linked_budget_id,
      priority, purpose, notes, contribution_frequency,
      opening_balance, current_amount,
      is_renewable, renewal_frequency, renewal_count, last_renewed_at
    ) VALUES (
      v_goal.user_id, v_goal.name, v_goal.target_amount, v_goal.icon, v_next_deadline, v_goal.account_id,
      v_goal.monthly_contribution, CURRENT_DATE, v_goal.contribution_day, v_goal.is_locked,
      v_goal.interest_rate, v_goal.interest_frequency, v_goal.bank_name, v_goal.linked_budget_id,
      v_goal.priority, v_goal.purpose, v_goal.notes, v_goal.contribution_frequency,
      0, 0,
      true, v_goal.renewal_frequency, v_goal.renewal_count + 1, now()
    );
    v_count := v_count + 1;
  END LOOP;

  RETURN jsonb_build_object('renewed', v_count);
END;
$$;

REVOKE ALL ON FUNCTION public.renew_savings_goals() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.renew_savings_goals() TO service_role;
