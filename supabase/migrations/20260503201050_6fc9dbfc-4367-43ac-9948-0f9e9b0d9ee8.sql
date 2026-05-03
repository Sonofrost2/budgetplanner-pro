
-- 1) Cleanup historical stale pending records (older than 1h, never confirmed)
UPDATE public.subscriptions
SET status = 'expired', canceled_at = now()
WHERE status IN ('pending', 'renewal_pending')
  AND created_at < now() - interval '1 hour';

DELETE FROM public.payment_receipts
WHERE status = 'pending'
  AND created_at < now() - interval '1 hour';

-- 2) Unique partial index: one active subscription per user
CREATE UNIQUE INDEX IF NOT EXISTS subscriptions_one_active_per_user
  ON public.subscriptions (user_id)
  WHERE status = 'active';

-- 3) Unique payment_token in receipts (idempotency for webhook + checkout)
CREATE UNIQUE INDEX IF NOT EXISTS payment_receipts_unique_token
  ON public.payment_receipts (payment_token)
  WHERE payment_token IS NOT NULL;

-- 4) Helper: check if a user already has an active subscription
CREATE OR REPLACE FUNCTION public.has_active_subscription(_user_id uuid)
RETURNS TABLE (plan_id uuid, plan_name text, current_period_end timestamptz)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT s.plan_id, p.name, s.current_period_end
  FROM public.subscriptions s
  JOIN public.subscription_plans p ON p.id = s.plan_id
  WHERE s.user_id = _user_id
    AND s.status = 'active'
    AND s.current_period_end > now()
  ORDER BY s.current_period_end DESC
  LIMIT 1;
$$;

-- 5) Auto-cleanup function for stale pending payments
CREATE OR REPLACE FUNCTION public.cleanup_stale_pending_payments()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Mark pending subs older than 1h as expired (cannot delete due to FK rules)
  UPDATE public.subscriptions
  SET status = 'expired', canceled_at = now()
  WHERE status IN ('pending', 'renewal_pending')
    AND created_at < now() - interval '1 hour';

  -- Delete pending receipts older than 1h (no FK)
  DELETE FROM public.payment_receipts
  WHERE status = 'pending'
    AND created_at < now() - interval '1 hour';
END;
$$;

-- 6) Schedule hourly cleanup via pg_cron (idempotent)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'cleanup-stale-pending-payments') THEN
    PERFORM cron.unschedule('cleanup-stale-pending-payments');
  END IF;
  PERFORM cron.schedule(
    'cleanup-stale-pending-payments',
    '17 * * * *',
    $cron$ SELECT public.cleanup_stale_pending_payments(); $cron$
  );
END $$;
