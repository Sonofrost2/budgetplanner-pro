-- ============= PHASE F: CYCLE DE VIE =============

-- Archivage comptes & catégories
ALTER TABLE public.payment_accounts ADD COLUMN IF NOT EXISTS archived_at timestamptz;
ALTER TABLE public.categories ADD COLUMN IF NOT EXISTS archived_at timestamptz;
CREATE INDEX IF NOT EXISTS idx_accounts_active_arch ON public.payment_accounts(user_id) WHERE archived_at IS NULL AND deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_categories_active_arch ON public.categories(user_id) WHERE archived_at IS NULL AND deleted_at IS NULL;

-- Pause budget + report reliquat
ALTER TABLE public.budgets ADD COLUMN IF NOT EXISTS paused_at timestamptz;
ALTER TABLE public.budgets ADD COLUMN IF NOT EXISTS carry_over boolean NOT NULL DEFAULT false;
ALTER TABLE public.budgets ADD COLUMN IF NOT EXISTS carried_amount numeric NOT NULL DEFAULT 0;

-- Pause épargne
ALTER TABLE public.savings_goals ADD COLUMN IF NOT EXISTS paused_at timestamptz;

-- Récurrences : skip + end_date
ALTER TABLE public.recurring_transactions ADD COLUMN IF NOT EXISTS skipped_dates date[] NOT NULL DEFAULT '{}';
ALTER TABLE public.recurring_transactions ADD COLUMN IF NOT EXISTS end_date date;

-- ============= PHASE G: RICHESSE FONCTIONNELLE =============

-- Transactions : split + tags + receipt
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS parent_transaction_id uuid REFERENCES public.transactions(id) ON DELETE CASCADE;
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS tags text[] NOT NULL DEFAULT '{}';
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS receipt_url text;
CREATE INDEX IF NOT EXISTS idx_tx_parent ON public.transactions(parent_transaction_id) WHERE parent_transaction_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_tx_tags ON public.transactions USING GIN(tags);

-- Sous-catégories
ALTER TABLE public.categories ADD COLUMN IF NOT EXISTS parent_category_id uuid REFERENCES public.categories(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_cat_parent ON public.categories(parent_category_id) WHERE parent_category_id IS NOT NULL;

-- Dettes : taux + échéancier
ALTER TABLE public.debts ADD COLUMN IF NOT EXISTS interest_rate numeric NOT NULL DEFAULT 0;
ALTER TABLE public.debts ADD COLUMN IF NOT EXISTS interest_type text NOT NULL DEFAULT 'simple';
ALTER TABLE public.debts ADD COLUMN IF NOT EXISTS payment_schedule jsonb NOT NULL DEFAULT '[]'::jsonb;

-- Storage bucket pour pièces justificatives
INSERT INTO storage.buckets (id, name, public) VALUES ('receipts', 'receipts', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Users can view own receipts"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'receipts' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can upload own receipts"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'receipts' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can update own receipts"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'receipts' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete own receipts"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'receipts' AND auth.uid()::text = (storage.foldername(name))[1]);

-- ============= PHASE H: VISION GLOBALE =============

-- Clôtures de période
CREATE TABLE IF NOT EXISTS public.period_closures (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  period_start date NOT NULL,
  period_end date NOT NULL,
  snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  locked boolean NOT NULL DEFAULT true,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, period_start, period_end)
);
ALTER TABLE public.period_closures ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own closures" ON public.period_closures
FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Templates de saisie rapide
CREATE TABLE IF NOT EXISTS public.transaction_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL,
  description text NOT NULL,
  amount numeric,
  type text NOT NULL DEFAULT 'expense',
  category_id uuid,
  account_id uuid,
  use_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.transaction_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own templates" ON public.transaction_templates
FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Filtres sauvegardés
CREATE TABLE IF NOT EXISTS public.saved_filters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL,
  scope text NOT NULL DEFAULT 'transactions',
  filters jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.saved_filters ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own filters" ON public.saved_filters
FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Spending batch pour budgets
CREATE OR REPLACE FUNCTION public.get_budgets_spending(p_user_id uuid, p_start_date date, p_end_date date)
RETURNS TABLE(category_id uuid, type text, total numeric)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT category_id, type, COALESCE(SUM(amount), 0)
  FROM public.transactions
  WHERE user_id = p_user_id
    AND deleted_at IS NULL
    AND category_id IS NOT NULL
    AND date >= p_start_date AND date <= p_end_date
  GROUP BY category_id, type;
$$;

-- Health Score financier
CREATE OR REPLACE FUNCTION public.compute_health_score(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
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

  SELECT COALESCE(SUM(current_amount),0) INTO v_savings_total
  FROM public.savings_goals WHERE user_id = p_user_id AND deleted_at IS NULL;

  SELECT COALESCE(SUM(total_amount - paid_amount),0) INTO v_debt_total
  FROM public.debts WHERE user_id = p_user_id AND deleted_at IS NULL;

  SELECT COUNT(*) INTO v_account_count
  FROM public.payment_accounts WHERE user_id = p_user_id AND deleted_at IS NULL AND archived_at IS NULL;

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
$$;

-- Trigger updated_at sur templates
CREATE TRIGGER update_templates_updated_at
BEFORE UPDATE ON public.transaction_templates
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();