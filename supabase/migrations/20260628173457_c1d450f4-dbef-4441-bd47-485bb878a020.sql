
-- payment_receipts: refund tracking
ALTER TABLE public.payment_receipts
  ADD COLUMN IF NOT EXISTS refunded_at timestamptz,
  ADD COLUMN IF NOT EXISTS refund_reason text,
  ADD COLUMN IF NOT EXISTS refunded_by uuid REFERENCES auth.users(id) ON DELETE SET NULL;

-- subscriptions: refund tracking
ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS refunded_at timestamptz,
  ADD COLUMN IF NOT EXISTS refund_reason text;

-- Admin-triggered refund (manual, e.g. 7-day refund window)
CREATE OR REPLACE FUNCTION public.admin_refund_subscription(
  p_subscription_id uuid,
  p_reason text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_sub record;
BEGIN
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;
  IF NOT public.has_role(v_actor, 'admin'::app_role) THEN
    RAISE EXCEPTION 'Admin role required';
  END IF;

  SELECT * INTO v_sub FROM public.subscriptions WHERE id = p_subscription_id;
  IF v_sub IS NULL THEN
    RAISE EXCEPTION 'Subscription not found';
  END IF;

  UPDATE public.subscriptions
     SET status = 'refunded',
         canceled_at = COALESCE(canceled_at, now()),
         refunded_at = now(),
         refund_reason = p_reason,
         current_period_end = LEAST(current_period_end, now()),
         updated_at = now()
   WHERE id = p_subscription_id;

  IF v_sub.last_payment_token IS NOT NULL THEN
    UPDATE public.payment_receipts
       SET status = 'refunded',
           refunded_at = now(),
           refund_reason = p_reason,
           refunded_by = v_actor
     WHERE payment_token = v_sub.last_payment_token
       AND user_id = v_sub.user_id;
  END IF;

  PERFORM public.log_audit_event(
    v_sub.user_id, v_actor,
    'admin_action', 'refund_subscription', 'success',
    p_reason, jsonb_build_object('subscription_id', p_subscription_id, 'reference', v_sub.last_payment_token),
    NULL, NULL, p_subscription_id::text
  );

  RETURN jsonb_build_object(
    'subscription_id', p_subscription_id,
    'user_id', v_sub.user_id,
    'reference', v_sub.last_payment_token,
    'refunded_at', now()
  );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_refund_subscription(uuid, text) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_refund_subscription(uuid, text) TO authenticated;

-- Webhook-triggered refund (Paystack refund.processed / charge.dispute.create)
CREATE OR REPLACE FUNCTION public.process_paystack_refund(
  p_payment_token text,
  p_reason text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sub record;
BEGIN
  IF auth.role() <> 'service_role' THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  SELECT * INTO v_sub
  FROM public.subscriptions
  WHERE last_payment_token = p_payment_token
  ORDER BY created_at DESC
  LIMIT 1;

  IF v_sub IS NULL THEN
    RETURN jsonb_build_object('matched', false);
  END IF;

  UPDATE public.subscriptions
     SET status = 'refunded',
         canceled_at = COALESCE(canceled_at, now()),
         refunded_at = now(),
         refund_reason = p_reason,
         current_period_end = LEAST(current_period_end, now()),
         updated_at = now()
   WHERE id = v_sub.id;

  UPDATE public.payment_receipts
     SET status = 'refunded',
         refunded_at = now(),
         refund_reason = p_reason
   WHERE payment_token = p_payment_token
     AND user_id = v_sub.user_id;

  PERFORM public.log_audit_event(
    v_sub.user_id, NULL,
    'payment', 'refund_processed', 'success',
    p_reason, jsonb_build_object('subscription_id', v_sub.id, 'reference', p_payment_token),
    NULL, NULL, v_sub.id::text
  );

  RETURN jsonb_build_object(
    'matched', true,
    'subscription_id', v_sub.id,
    'user_id', v_sub.user_id
  );
END;
$$;

REVOKE ALL ON FUNCTION public.process_paystack_refund(text, text) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.process_paystack_refund(text, text) TO service_role;
