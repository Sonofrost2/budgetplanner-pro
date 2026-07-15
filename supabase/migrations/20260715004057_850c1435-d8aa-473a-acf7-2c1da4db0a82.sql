
-- ────────────────────────────────────────────────────────────────
-- S1 + S2 + S3 + S4 : Budgets one-shot renouvelables + épargne + form
-- ────────────────────────────────────────────────────────────────

-- 1. Nouvelles colonnes sur budgets
ALTER TABLE public.budgets
  ADD COLUMN IF NOT EXISTS is_renewable boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS carry_over boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS notes text,
  ADD COLUMN IF NOT EXISTS priority text NOT NULL DEFAULT 'medium',
  ADD COLUMN IF NOT EXISTS tags text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS payment_account_id uuid REFERENCES public.payment_accounts(id) ON DELETE SET NULL;

-- CHECK priorité (valeurs immuables)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'budgets_priority_check'
  ) THEN
    ALTER TABLE public.budgets
      ADD CONSTRAINT budgets_priority_check
      CHECK (priority IN ('low','medium','high'));
  END IF;
END $$;

-- Index pour requêtes tags / priorité
CREATE INDEX IF NOT EXISTS idx_budgets_priority ON public.budgets(priority);
CREATE INDEX IF NOT EXISTS idx_budgets_tags ON public.budgets USING GIN(tags);
CREATE INDEX IF NOT EXISTS idx_budgets_payment_account ON public.budgets(payment_account_id) WHERE payment_account_id IS NOT NULL;

-- ────────────────────────────────────────────────────────────────
-- 2. Contrainte sémantique : once ⇒ yearly
-- ────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.enforce_once_yearly()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.occurrence_frequency = 'once' AND (NEW.period IS NULL OR NEW.period <> 'yearly') THEN
    NEW.period := 'yearly';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_once_yearly ON public.budgets;
CREATE TRIGGER trg_enforce_once_yearly
  BEFORE INSERT OR UPDATE OF occurrence_frequency, period ON public.budgets
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_once_yearly();

-- ────────────────────────────────────────────────────────────────
-- 3. Table d'historique des cycles clôturés (audit + rapports)
-- ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.budget_cycle_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  budget_id uuid NOT NULL REFERENCES public.budgets(id) ON DELETE CASCADE,
  cycle_start date NOT NULL,
  cycle_end date NOT NULL,
  amount_budgeted numeric NOT NULL,
  amount_spent numeric NOT NULL DEFAULT 0,
  status text NOT NULL, -- 'fulfilled' | 'partial' | 'missed' | 'exceeded' | 'archived'
  carry_over_amount numeric NOT NULL DEFAULT 0,
  closed_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.budget_cycle_history TO authenticated;
GRANT ALL ON public.budget_cycle_history TO service_role;

ALTER TABLE public.budget_cycle_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own budget history"
  ON public.budget_cycle_history
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_budget_cycle_history_user ON public.budget_cycle_history(user_id, closed_at DESC);
CREATE INDEX IF NOT EXISTS idx_budget_cycle_history_budget ON public.budget_cycle_history(budget_id, cycle_start DESC);

-- ────────────────────────────────────────────────────────────────
-- 4. Consommation d'un budget lié à une épargne
--    Somme des transferts ENTRANTS vers le compte d'épargne sur la période.
-- ────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_savings_contribution(
  p_user_id uuid,
  p_goal_id uuid,
  p_start_date date,
  p_end_date date
)
RETURNS numeric
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(SUM(t.amount), 0)
  FROM public.transactions t
  JOIN public.savings_goals g ON g.id = p_goal_id
  WHERE t.user_id = p_user_id
    AND t.is_transfer = true
    AND t.type = 'income'
    AND t.account_id = g.account_id
    AND t.deleted_at IS NULL
    AND t.date BETWEEN p_start_date AND p_end_date;
$$;

REVOKE EXECUTE ON FUNCTION public.get_savings_contribution(uuid, uuid, date, date) FROM anon;
GRANT EXECUTE ON FUNCTION public.get_savings_contribution(uuid, uuid, date, date) TO authenticated, service_role;

-- ────────────────────────────────────────────────────────────────
-- 5. Rollover des budgets one-shot en fin de cycle
--    Idempotent : peut tourner quotidiennement, ne traite que les cycles échus.
-- ────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.rollover_once_budgets(p_user_id uuid DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r record;
  v_cycle_start date;
  v_cycle_end date;
  v_spent numeric;
  v_status text;
  v_renewed int := 0;
  v_archived int := 0;
BEGIN
  FOR r IN
    SELECT b.*
    FROM public.budgets b
    WHERE b.occurrence_frequency = 'once'
      AND b.reference_date IS NOT NULL
      AND b.deleted_at IS NULL
      AND b.archived_at IS NULL
      AND (b.reference_date + INTERVAL '1 year')::date <= CURRENT_DATE
      AND (p_user_id IS NULL OR b.user_id = p_user_id)
  LOOP
    -- Fenêtre du cycle qui vient de se terminer
    v_cycle_start := r.reference_date;
    v_cycle_end := (r.reference_date + INTERVAL '1 year' - INTERVAL '1 day')::date;

    -- Conso réalisée sur ce cycle (transactions ou épargne)
    IF r.linked_savings_goal_id IS NOT NULL THEN
      SELECT public.get_savings_contribution(r.user_id, r.linked_savings_goal_id, v_cycle_start, v_cycle_end)
        INTO v_spent;
    ELSIF r.category_id IS NOT NULL THEN
      SELECT public.get_budget_spending(r.user_id, r.category_id, COALESCE(r.budget_type, 'expense'), v_cycle_start, v_cycle_end)
        INTO v_spent;
    ELSE
      v_spent := 0;
    END IF;

    -- Statut final
    IF v_spent > r.amount THEN
      v_status := 'exceeded';
    ELSIF v_spent >= r.amount THEN
      v_status := 'fulfilled';
    ELSIF v_spent > 0 THEN
      v_status := 'partial';
    ELSE
      v_status := 'missed';
    END IF;

    -- Snapshot
    INSERT INTO public.budget_cycle_history(
      user_id, budget_id, cycle_start, cycle_end,
      amount_budgeted, amount_spent, status,
      carry_over_amount
    ) VALUES (
      r.user_id, r.id, v_cycle_start, v_cycle_end,
      r.amount, v_spent, v_status,
      CASE WHEN r.carry_over AND v_spent < r.amount THEN (r.amount - v_spent) ELSE 0 END
    );

    -- Reconduction ou archivage
    IF r.is_renewable THEN
      UPDATE public.budgets
        SET reference_date = (r.reference_date + INTERVAL '1 year')::date,
            amount = CASE
              WHEN r.carry_over AND v_spent < r.amount
              THEN r.amount + (r.amount - v_spent)
              ELSE r.amount
            END,
            updated_at = now()
        WHERE id = r.id;
      v_renewed := v_renewed + 1;
    ELSE
      UPDATE public.budgets
        SET archived_at = now(),
            updated_at = now()
        WHERE id = r.id;
      v_archived := v_archived + 1;
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'renewed', v_renewed,
    'archived', v_archived,
    'processed_at', now()
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.rollover_once_budgets(uuid) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rollover_once_budgets(uuid) TO service_role;
