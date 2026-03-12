
CREATE TABLE public.debts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  creditor_name text NOT NULL,
  total_amount numeric NOT NULL,
  paid_amount numeric DEFAULT 0,
  due_date date,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE public.debts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own debts" ON public.debts FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE TABLE public.recurring_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  description text NOT NULL,
  amount numeric NOT NULL,
  type text DEFAULT 'expense',
  category_id uuid REFERENCES public.categories(id),
  account_id uuid REFERENCES public.payment_accounts(id),
  frequency text DEFAULT 'monthly',
  next_date date NOT NULL,
  active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.recurring_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own recurring" ON public.recurring_transactions FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE TABLE public.cash_counts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  account_id uuid REFERENCES public.payment_accounts(id),
  counted_at timestamptz DEFAULT now(),
  denominations jsonb NOT NULL DEFAULT '{}',
  total_counted numeric DEFAULT 0,
  expected_balance numeric DEFAULT 0,
  discrepancy numeric DEFAULT 0,
  notes text
);
ALTER TABLE public.cash_counts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own cash counts" ON public.cash_counts FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
