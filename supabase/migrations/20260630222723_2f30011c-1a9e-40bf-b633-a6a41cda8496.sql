
UPDATE public.subscriptions SET billing_cycle = 'monthly' WHERE billing_cycle IS NULL;
ALTER TABLE public.subscriptions ALTER COLUMN billing_cycle SET DEFAULT 'monthly';
CREATE INDEX IF NOT EXISTS idx_subscriptions_user_status ON public.subscriptions(user_id, status);
CREATE INDEX IF NOT EXISTS idx_subscriptions_period_end ON public.subscriptions(current_period_end) WHERE status = 'active';
