
ALTER TABLE public.payment_receipts
  ADD COLUMN IF NOT EXISTS display_amount NUMERIC,
  ADD COLUMN IF NOT EXISTS display_currency TEXT;

DROP FUNCTION IF EXISTS public.admin_list_payment_receipts(timestamp with time zone, timestamp with time zone, text, text, text, integer);

CREATE OR REPLACE FUNCTION public.admin_list_payment_receipts(
  p_start_date timestamp with time zone DEFAULT NULL,
  p_end_date timestamp with time zone DEFAULT NULL,
  p_status text DEFAULT NULL,
  p_plan text DEFAULT NULL,
  p_payment_method text DEFAULT NULL,
  p_limit integer DEFAULT 500
)
RETURNS TABLE(
  id uuid,
  created_at timestamp with time zone,
  user_id uuid,
  user_email text,
  display_name text,
  plan_name text,
  amount numeric,
  currency text,
  display_amount numeric,
  display_currency text,
  payment_token text,
  payment_method text,
  status text,
  refunded_at timestamp with time zone,
  refund_reason text,
  billing_cycle text
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public', 'auth'
AS $function$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'admin role required';
  END IF;

  RETURN QUERY
    SELECT
      pr.id,
      pr.created_at,
      pr.user_id,
      u.email::text,
      p.display_name,
      pr.plan_name,
      pr.amount,
      pr.currency,
      pr.display_amount,
      pr.display_currency,
      pr.payment_token,
      s.payment_method,
      pr.status,
      pr.refunded_at,
      pr.refund_reason,
      s.billing_cycle
    FROM public.payment_receipts pr
    LEFT JOIN auth.users u ON u.id = pr.user_id
    LEFT JOIN public.profiles p ON p.user_id = pr.user_id
    LEFT JOIN LATERAL (
      SELECT s2.payment_method, s2.billing_cycle
      FROM public.subscriptions s2
      WHERE s2.last_payment_token = pr.payment_token
      ORDER BY s2.created_at DESC
      LIMIT 1
    ) s ON true
    WHERE (p_start_date IS NULL OR pr.created_at >= p_start_date)
      AND (p_end_date IS NULL OR pr.created_at <= p_end_date)
      AND (p_status IS NULL OR pr.status = p_status)
      AND (p_plan IS NULL OR pr.plan_name = p_plan)
      AND (p_payment_method IS NULL OR s.payment_method = p_payment_method)
    ORDER BY pr.created_at DESC
    LIMIT p_limit;
END;
$function$;
