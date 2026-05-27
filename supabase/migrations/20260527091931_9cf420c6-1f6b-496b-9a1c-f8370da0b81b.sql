
-- 1) Lock down subscriptions: remove client write policies
DROP POLICY IF EXISTS "Users can insert own subscriptions" ON public.subscriptions;
DROP POLICY IF EXISTS "Users can update own subscriptions" ON public.subscriptions;
DROP POLICY IF EXISTS "Users can delete own subscriptions" ON public.subscriptions;

-- Explicit deny for clarity
CREATE POLICY "Deny client inserts on subscriptions"
ON public.subscriptions FOR INSERT TO authenticated WITH CHECK (false);
CREATE POLICY "Deny client updates on subscriptions"
ON public.subscriptions FOR UPDATE TO authenticated USING (false);
CREATE POLICY "Deny client deletes on subscriptions"
ON public.subscriptions FOR DELETE TO authenticated USING (false);

-- 2) Lock down payment_receipts: remove client insert policy
DROP POLICY IF EXISTS "Users can insert own receipts" ON public.payment_receipts;

CREATE POLICY "Deny client inserts on payment_receipts"
ON public.payment_receipts FOR INSERT TO authenticated WITH CHECK (false);

-- 3) Secure RPC: cancel own active subscription
CREATE OR REPLACE FUNCTION public.cancel_my_subscription(p_subscription_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  UPDATE public.subscriptions
     SET status = 'canceled', canceled_at = now(), updated_at = now()
   WHERE id = p_subscription_id
     AND user_id = auth.uid()
     AND status = 'active';
END;
$$;

REVOKE ALL ON FUNCTION public.cancel_my_subscription(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cancel_my_subscription(uuid) TO authenticated;

-- 4) Secure RPC: admin-only QA plan switch (no payment)
CREATE OR REPLACE FUNCTION public.admin_switch_my_plan(p_plan_name text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_plan_id uuid;
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF NOT public.has_role(v_uid, 'admin'::app_role) THEN
    RAISE EXCEPTION 'Admin role required';
  END IF;

  SELECT id INTO v_plan_id FROM public.subscription_plans
   WHERE name = p_plan_name AND active = true LIMIT 1;
  IF v_plan_id IS NULL THEN
    RAISE EXCEPTION 'Plan not found';
  END IF;

  UPDATE public.subscriptions
     SET status = 'canceled', canceled_at = now(), updated_at = now()
   WHERE user_id = v_uid AND status = 'active';

  INSERT INTO public.subscriptions
    (user_id, plan_id, status, started_at, current_period_start, current_period_end, payment_method)
  VALUES
    (v_uid, v_plan_id, 'active', now(), now(), now() + interval '1 month', 'admin-test');
END;
$$;

REVOKE ALL ON FUNCTION public.admin_switch_my_plan(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_switch_my_plan(text) TO authenticated;

-- 5) Secure RPC: activate a pending subscription after verified payment
-- The edge function calls this with service_role; signed-in users CAN'T call it
-- because the function checks the caller is service_role (via has_role check fallback).
CREATE OR REPLACE FUNCTION public.activate_paid_subscription(
  p_user_id uuid,
  p_reference text,
  p_period_days integer DEFAULT 30
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sub_id uuid;
BEGIN
  -- Only callable from service_role context (no auth.uid())
  IF auth.role() <> 'service_role' THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  SELECT id INTO v_sub_id FROM public.subscriptions
   WHERE user_id = p_user_id
     AND last_payment_token = p_reference
     AND status = 'pending'
   ORDER BY created_at DESC
   LIMIT 1;

  IF v_sub_id IS NULL THEN
    RETURN NULL;
  END IF;

  UPDATE public.subscriptions
     SET status = 'active',
         current_period_start = now(),
         current_period_end = now() + (p_period_days || ' days')::interval,
         updated_at = now()
   WHERE id = v_sub_id;

  UPDATE public.payment_receipts
     SET status = 'confirmed'
   WHERE user_id = p_user_id
     AND payment_token = p_reference;

  RETURN v_sub_id;
END;
$$;

REVOKE ALL ON FUNCTION public.activate_paid_subscription(uuid, text, integer) FROM PUBLIC, anon, authenticated;

-- 6) Revoke EXECUTE on internal trigger-only / definer-helper functions that
--    should never be invoked directly by client roles.
DO $$
DECLARE
  fn text;
BEGIN
  FOR fn IN
    SELECT format('%I(%s)', p.proname, pg_get_function_identity_arguments(p.oid))
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.prosecdef = true
      AND p.proname = ANY (ARRAY[
        'handle_new_user',
        'auto_add_owner_as_member',
        'bump_conversation_updated_at',
        'notify_family_on_large_transaction',
        'notify_on_transaction_insert',
        'on_family_member_added',
        'create_default_categories',
        'create_default_notification_preferences',
        'check_savings_completion',
        'cleanup_expired_ai_cache',
        'cleanup_old_deleted',
        'cleanup_old_notifications',
        'cleanup_stale_pending_payments'
      ])
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION public.%s FROM PUBLIC, anon, authenticated', fn);
  END LOOP;
END $$;
