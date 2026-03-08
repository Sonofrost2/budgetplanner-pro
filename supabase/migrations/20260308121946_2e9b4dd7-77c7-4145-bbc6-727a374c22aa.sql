
-- 1. payment_accounts table
CREATE TABLE public.payment_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL,
  type text NOT NULL DEFAULT 'mobile_money',
  icon text NOT NULL DEFAULT '💳',
  opening_balance numeric NOT NULL DEFAULT 0,
  real_balance numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.payment_accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own accounts" ON public.payment_accounts FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- 2. user_roles table
CREATE TYPE public.app_role AS ENUM ('admin', 'user');
CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  UNIQUE (user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can read own roles" ON public.user_roles FOR SELECT
  USING (auth.uid() = user_id);

-- 3. has_role security definer function
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- 4. subscription_plans table
CREATE TABLE public.subscription_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  base_price numeric NOT NULL DEFAULT 0,
  currency_prices jsonb NOT NULL DEFAULT '{}',
  trial_days int NOT NULL DEFAULT 0,
  features jsonb NOT NULL DEFAULT '[]',
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.subscription_plans ENABLE ROW LEVEL SECURITY;
-- Everyone can read active plans
CREATE POLICY "Anyone can read active plans" ON public.subscription_plans FOR SELECT
  USING (active = true);
-- Only admins can insert/update/delete
CREATE POLICY "Admins can insert plans" ON public.subscription_plans FOR INSERT
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can update plans" ON public.subscription_plans FOR UPDATE
  USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can delete plans" ON public.subscription_plans FOR DELETE
  USING (public.has_role(auth.uid(), 'admin'));

-- 5. Add account_id to transactions
ALTER TABLE public.transactions ADD COLUMN account_id uuid REFERENCES public.payment_accounts(id);

-- 6. Add account_id to savings_goals
ALTER TABLE public.savings_goals ADD COLUMN account_id uuid REFERENCES public.payment_accounts(id);

-- 7. Add onboarding_completed to profiles
ALTER TABLE public.profiles ADD COLUMN onboarding_completed boolean NOT NULL DEFAULT false;

-- 8. updated_at triggers
CREATE TRIGGER update_payment_accounts_updated_at BEFORE UPDATE ON public.payment_accounts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_subscription_plans_updated_at BEFORE UPDATE ON public.subscription_plans
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
