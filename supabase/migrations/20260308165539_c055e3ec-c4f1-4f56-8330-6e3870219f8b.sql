
-- Subscriptions table to track active user subscriptions
CREATE TABLE public.subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  plan_id uuid REFERENCES public.subscription_plans(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'active',
  started_at timestamp with time zone NOT NULL DEFAULT now(),
  current_period_start timestamp with time zone NOT NULL DEFAULT now(),
  current_period_end timestamp with time zone NOT NULL DEFAULT (now() + interval '1 month'),
  canceled_at timestamp with time zone,
  payment_method text DEFAULT 'paydunya',
  last_payment_token text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own subscriptions" ON public.subscriptions
FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own subscriptions" ON public.subscriptions
FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own subscriptions" ON public.subscriptions
FOR UPDATE TO authenticated USING (auth.uid() = user_id);

-- Update trigger
CREATE TRIGGER update_subscriptions_updated_at
  BEFORE UPDATE ON public.subscriptions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Update free plan to be more restrictive
UPDATE public.subscription_plans
SET features = '["15 transactions/mois", "1 seul compte", "1 seul budget", "Pas de prévisions IA", "Pas d''export"]'::jsonb
WHERE name = 'free';

-- Update premium plan features
UPDATE public.subscription_plans
SET features = '["Transactions illimitées", "Comptes illimités", "Budgets illimités", "Prévisions IA", "Rapports avancés", "Export PDF/Excel", "Gestion familiale", "Support prioritaire"]'::jsonb
WHERE name = 'premium';
