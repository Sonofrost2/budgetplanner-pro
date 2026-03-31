
-- Fix RLS policies: change role from public to authenticated

-- profiles
ALTER POLICY "Users can view their own profile" ON public.profiles TO authenticated;
ALTER POLICY "Users can update their own profile" ON public.profiles TO authenticated;
ALTER POLICY "Users can insert their own profile" ON public.profiles TO authenticated;

-- categories
ALTER POLICY "Users can manage their own categories" ON public.categories TO authenticated;

-- budgets
ALTER POLICY "Users can manage their own budgets" ON public.budgets TO authenticated;

-- transactions
ALTER POLICY "Users can manage their own transactions" ON public.transactions TO authenticated;

-- payment_receipts
ALTER POLICY "Users can insert own receipts" ON public.payment_receipts TO authenticated;
ALTER POLICY "Users can read own receipts" ON public.payment_receipts TO authenticated;

-- savings_goals
ALTER POLICY "Users can manage their own savings goals" ON public.savings_goals TO authenticated;

-- user_roles
ALTER POLICY "Users can read own roles" ON public.user_roles TO authenticated;

-- payment_accounts
ALTER POLICY "Users manage own accounts" ON public.payment_accounts TO authenticated;

-- subscription_plans (admin policies already scoped, but fix the public-scoped ones)
ALTER POLICY "Admins can delete plans" ON public.subscription_plans TO authenticated;
ALTER POLICY "Admins can insert plans" ON public.subscription_plans TO authenticated;
ALTER POLICY "Admins can update plans" ON public.subscription_plans TO authenticated;
