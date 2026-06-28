
ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS billing_cycle text
  CHECK (billing_cycle IN ('monthly','annual'));

CREATE OR REPLACE FUNCTION public.activate_paid_subscription(
  p_user_id uuid,
  p_reference text,
  p_period_days integer DEFAULT 30,
  p_billing_cycle text DEFAULT 'monthly'
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sub_id uuid;
BEGIN
  IF auth.role() <> 'service_role' THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  IF p_billing_cycle NOT IN ('monthly','annual') THEN
    p_billing_cycle := 'monthly';
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
         billing_cycle = p_billing_cycle,
         updated_at = now()
   WHERE id = v_sub_id;

  UPDATE public.payment_receipts
     SET status = 'confirmed'
   WHERE user_id = p_user_id
     AND payment_token = p_reference;

  RETURN v_sub_id;
END;
$$;

REVOKE ALL ON FUNCTION public.activate_paid_subscription(uuid, text, integer, text) FROM PUBLIC, anon, authenticated;
