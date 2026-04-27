-- =============================================================
-- 1. Helpers
-- =============================================================

CREATE OR REPLACE FUNCTION public.get_demo_user_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT id FROM auth.users WHERE email = 'demo@budgetplanner.app' LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.is_demo_user(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT EXISTS (
    SELECT 1 FROM auth.users WHERE id = _user_id AND email = 'demo@budgetplanner.app'
  );
$$;

-- =============================================================
-- 2. Create demo user if missing (idempotent)
-- =============================================================

DO $$
DECLARE
  v_user_id uuid;
BEGIN
  SELECT id INTO v_user_id FROM auth.users WHERE email = 'demo@budgetplanner.app';
  IF v_user_id IS NULL THEN
    v_user_id := gen_random_uuid();
    INSERT INTO auth.users (
      id, instance_id, aud, role, email, encrypted_password,
      email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
      created_at, updated_at, confirmation_token, email_change, email_change_token_new, recovery_token
    ) VALUES (
      v_user_id,
      '00000000-0000-0000-0000-000000000000',
      'authenticated',
      'authenticated',
      'demo@budgetplanner.app',
      crypt('DemoBudget2026!', gen_salt('bf')),
      now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{"display_name":"Compte Démo","is_demo":true}'::jsonb,
      now(), now(), '', '', '', ''
    );
    INSERT INTO auth.identities (id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at)
    VALUES (
      gen_random_uuid(),
      v_user_id,
      jsonb_build_object('sub', v_user_id::text, 'email', 'demo@budgetplanner.app', 'email_verified', true),
      'email',
      v_user_id::text,
      now(), now(), now()
    );
  END IF;
END $$;

-- Ensure profile exists
INSERT INTO public.profiles (user_id, display_name, currency, locale, onboarding_completed, country_code, signup_country)
SELECT public.get_demo_user_id(), 'Compte Démo', 'XOF', 'fr', true, 'CI', 'CI'
WHERE public.get_demo_user_id() IS NOT NULL
ON CONFLICT (user_id) DO UPDATE
  SET display_name='Compte Démo', currency='XOF', locale='fr', onboarding_completed=true;

-- =============================================================
-- 3. Reset + seed function
-- =============================================================

CREATE OR REPLACE FUNCTION public.reset_demo_account()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  u uuid;
  acc_cash uuid := gen_random_uuid();
  acc_wave uuid := gen_random_uuid();
  acc_orange uuid := gen_random_uuid();
  acc_bank uuid := gen_random_uuid();
  acc_savings uuid := gen_random_uuid();
  cat_food uuid := gen_random_uuid();
  cat_transport uuid := gen_random_uuid();
  cat_housing uuid := gen_random_uuid();
  cat_leisure uuid := gen_random_uuid();
  cat_health uuid := gen_random_uuid();
  cat_salary uuid := gen_random_uuid();
  cat_freelance uuid := gen_random_uuid();
  cat_subs uuid := gen_random_uuid();
  today date := CURRENT_DATE;
BEGIN
  u := public.get_demo_user_id();
  IF u IS NULL THEN RAISE NOTICE 'Demo user missing'; RETURN; END IF;

  -- Wipe (order matters)
  DELETE FROM public.transactions WHERE user_id = u;
  DELETE FROM public.recurring_transactions WHERE user_id = u;
  DELETE FROM public.budgets WHERE user_id = u;
  DELETE FROM public.savings_goals WHERE user_id = u;
  DELETE FROM public.debts WHERE user_id = u;
  DELETE FROM public.assets WHERE user_id = u;
  DELETE FROM public.asset_valuations WHERE user_id = u;
  DELETE FROM public.cash_counts WHERE user_id = u;
  DELETE FROM public.categories WHERE user_id = u;
  DELETE FROM public.payment_accounts WHERE user_id = u;
  DELETE FROM public.ai_messages WHERE user_id = u;
  DELETE FROM public.ai_conversations WHERE user_id = u;
  DELETE FROM public.notification_history WHERE user_id = u;
  DELETE FROM public.notification_queue WHERE user_id = u;

  -- Accounts
  INSERT INTO public.payment_accounts (id, user_id, name, type, icon, opening_balance, real_balance, status) VALUES
    (acc_cash, u, 'Espèces', 'cash', '💵', 25000, 25000, 'active'),
    (acc_wave, u, 'Wave', 'mobile_money', '🌊', 85000, 85000, 'active'),
    (acc_orange, u, 'Orange Money', 'mobile_money', '🟠', 45000, 45000, 'active'),
    (acc_bank, u, 'SGCI Compte courant', 'bank', '🏦', 320000, 320000, 'active'),
    (acc_savings, u, 'Épargne SGCI', 'savings', '🐷', 150000, 150000, 'active');

  -- Categories
  INSERT INTO public.categories (id, user_id, name, icon, color, type) VALUES
    (cat_salary, u, 'Salaire', '💼', '#10B981', 'income'),
    (cat_freelance, u, 'Freelance', '💻', '#34D399', 'income'),
    (cat_food, u, 'Alimentation', '🍽️', '#F59E0B', 'expense'),
    (cat_transport, u, 'Transport', '🚗', '#3B82F6', 'expense'),
    (cat_housing, u, 'Logement', '🏠', '#8B5CF6', 'expense'),
    (cat_leisure, u, 'Loisirs', '🎬', '#EC4899', 'expense'),
    (cat_health, u, 'Santé', '⚕️', '#EF4444', 'expense'),
    (cat_subs, u, 'Abonnements', '📺', '#6366F1', 'expense');

  -- Transactions (~15 over last 30 days)
  INSERT INTO public.transactions (user_id, account_id, category_id, type, amount, description, date) VALUES
    (u, acc_bank, cat_salary, 'income', 450000, 'Salaire mensuel', today - 25),
    (u, acc_wave, cat_freelance, 'income', 75000, 'Mission freelance design', today - 18),
    (u, acc_bank, cat_housing, 'expense', 120000, 'Loyer mensuel', today - 24),
    (u, acc_wave, cat_food, 'expense', 18500, 'Courses Prosuma', today - 22),
    (u, acc_cash, cat_food, 'expense', 4500, 'Maquis du midi', today - 20),
    (u, acc_orange, cat_transport, 'expense', 8000, 'Carburant', today - 19),
    (u, acc_wave, cat_subs, 'expense', 6500, 'Netflix + Spotify', today - 17),
    (u, acc_cash, cat_leisure, 'expense', 12000, 'Cinéma + restaurant', today - 14),
    (u, acc_wave, cat_food, 'expense', 22000, 'Courses semaine', today - 12),
    (u, acc_orange, cat_transport, 'expense', 3500, 'Yango trajets', today - 10),
    (u, acc_bank, cat_health, 'expense', 25000, 'Pharmacie', today - 8),
    (u, acc_wave, cat_food, 'expense', 9500, 'Livraison Glovo', today - 6),
    (u, acc_cash, cat_food, 'expense', 5000, 'Petit-déjeuner', today - 4),
    (u, acc_orange, cat_leisure, 'expense', 15000, 'Concert', today - 3),
    (u, acc_wave, cat_food, 'expense', 16500, 'Courses week-end', today - 1);

  -- Budgets
  INSERT INTO public.budgets (user_id, category_id, name, amount, period, control_type, budget_type, alert_threshold) VALUES
    (u, cat_food, 'Alimentation mensuelle', 80000, 'monthly', 'max', 'expense', 80),
    (u, cat_transport, 'Transport mensuel', 25000, 'monthly', 'max', 'expense', 80),
    (u, cat_leisure, 'Loisirs mensuels', 30000, 'monthly', 'max', 'expense', 80);

  -- Savings goal
  INSERT INTO public.savings_goals (user_id, account_id, name, target_amount, current_amount, deadline, icon, monthly_contribution, start_date, status) VALUES
    (u, acc_savings, 'Vacances Maroc', 600000, 150000, today + 180, '✈️', 50000, today - 90, 'active');

  -- Debt
  INSERT INTO public.debts (user_id, account_id, creditor_name, total_amount, paid_amount, due_date, interest_rate, interest_type, notes) VALUES
    (u, acc_bank, 'Crédit moto', 800000, 320000, today + 365, 8.5, 'simple', 'Mensualité 25 000 FCFA');
END;
$$;

-- Run initial seed
SELECT public.reset_demo_account();

-- =============================================================
-- 4. Schedule daily reset at 03:00 UTC via pg_cron
-- =============================================================

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.unschedule('reset-demo-account-daily')
      WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'reset-demo-account-daily');
    PERFORM cron.schedule(
      'reset-demo-account-daily',
      '0 3 * * *',
      $cron$ SELECT public.reset_demo_account(); $cron$
    );
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'pg_cron scheduling skipped: %', SQLERRM;
END $$;