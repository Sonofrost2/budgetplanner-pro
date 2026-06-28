
CREATE OR REPLACE FUNCTION public.admin_billing_kpis()
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_mrr numeric := 0;
  v_active_by_plan jsonb;
  v_refund_rate numeric := 0;
  v_revenue_month numeric := 0;
  v_total_receipts int := 0;
  v_refunded_receipts int := 0;
  v_revenue_by_currency jsonb;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'admin role required';
  END IF;

  -- MRR estimé en XOF : prix mensuel × abonnés actifs (annuel ÷ 12 si applicable)
  SELECT COALESCE(SUM(
    CASE
      WHEN s.billing_cycle = 'annual'
        THEN COALESCE((sp.currency_prices->>'XOF')::numeric, 0) * 10.0 / 12.0
      ELSE COALESCE((sp.currency_prices->>'XOF')::numeric, 0)
    END
  ), 0)
  INTO v_mrr
  FROM public.subscriptions s
  JOIN public.subscription_plans sp ON sp.id = s.plan_id
  WHERE s.status = 'active'
    AND s.current_period_end > now()
    AND sp.name <> 'free';

  SELECT COALESCE(jsonb_object_agg(plan_name, cnt), '{}'::jsonb) INTO v_active_by_plan
  FROM (
    SELECT sp.name AS plan_name, COUNT(*) AS cnt
    FROM public.subscriptions s
    JOIN public.subscription_plans sp ON sp.id = s.plan_id
    WHERE s.status = 'active' AND s.current_period_end > now()
    GROUP BY sp.name
  ) q;

  SELECT
    COUNT(*) FILTER (WHERE created_at > now() - interval '90 days'),
    COUNT(*) FILTER (WHERE status = 'refunded' AND created_at > now() - interval '90 days')
  INTO v_total_receipts, v_refunded_receipts
  FROM public.payment_receipts;

  IF v_total_receipts > 0 THEN
    v_refund_rate := (v_refunded_receipts::numeric / v_total_receipts::numeric) * 100.0;
  END IF;

  SELECT COALESCE(jsonb_object_agg(currency, total), '{}'::jsonb) INTO v_revenue_by_currency
  FROM (
    SELECT currency, SUM(amount) AS total
    FROM public.payment_receipts
    WHERE status = 'confirmed'
      AND created_at >= date_trunc('month', now())
    GROUP BY currency
  ) q;

  SELECT COALESCE(SUM(amount), 0) INTO v_revenue_month
  FROM public.payment_receipts
  WHERE status = 'confirmed'
    AND currency = 'XOF'
    AND created_at >= date_trunc('month', now());

  RETURN jsonb_build_object(
    'mrr_xof', v_mrr,
    'active_by_plan', v_active_by_plan,
    'refund_rate_90d', v_refund_rate,
    'total_receipts_90d', v_total_receipts,
    'refunded_receipts_90d', v_refunded_receipts,
    'revenue_month_xof', v_revenue_month,
    'revenue_month_by_currency', v_revenue_by_currency
  );
END;
$$;
