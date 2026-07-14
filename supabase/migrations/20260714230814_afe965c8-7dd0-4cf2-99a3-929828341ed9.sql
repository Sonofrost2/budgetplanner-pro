
-- 1) Allow user to cancel/delete their own pending or canceled receipt
CREATE OR REPLACE FUNCTION public.cancel_my_pending_receipt(p_receipt_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  DELETE FROM public.payment_receipts
   WHERE id = p_receipt_id
     AND user_id = auth.uid()
     AND status IN ('pending', 'canceled', 'expired');
END;
$$;
REVOKE ALL ON FUNCTION public.cancel_my_pending_receipt(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cancel_my_pending_receipt(uuid) TO authenticated;

-- 2) Sweep: prefer marking as 'canceled' instead of DELETE so history remains visible
CREATE OR REPLACE FUNCTION public.cleanup_stale_pending_payments()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.subscriptions
     SET status = 'expired', canceled_at = now()
   WHERE status IN ('pending', 'renewal_pending')
     AND created_at < now() - interval '1 hour';

  UPDATE public.payment_receipts
     SET status = 'canceled'
   WHERE status = 'pending'
     AND created_at < now() - interval '1 hour';
END;
$$;

-- 3) Neutralize the old admin_switch_my_plan: it must NOT touch real subscription
--    nor create billing entries. Keep the RPC name to avoid breaking old clients
--    but make it a no-op that returns immediately.
CREATE OR REPLACE FUNCTION public.admin_switch_my_plan(p_plan_name text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Deprecated: QA plan override is now handled client-side (session only).
  -- We deliberately do nothing to avoid mutating the real subscription
  -- or generating spurious billing history.
  RETURN;
END;
$$;
