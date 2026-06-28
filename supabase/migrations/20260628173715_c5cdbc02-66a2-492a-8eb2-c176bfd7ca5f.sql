
CREATE OR REPLACE FUNCTION public.admin_list_payment_receipts(
  p_start_date timestamptz DEFAULT NULL,
  p_end_date timestamptz DEFAULT NULL,
  p_status text DEFAULT NULL,
  p_plan text DEFAULT NULL,
  p_payment_method text DEFAULT NULL,
  p_limit int DEFAULT 500
)
RETURNS TABLE(
  id uuid,
  created_at timestamptz,
  user_id uuid,
  user_email text,
  display_name text,
  plan_name text,
  amount numeric,
  currency text,
  payment_token text,
  payment_method text,
  status text,
  refunded_at timestamptz,
  refund_reason text,
  billing_cycle text
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public, auth
AS $$
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
      SELECT s.payment_method, s.billing_cycle
      FROM public.subscriptions s
      WHERE s.last_payment_token = pr.payment_token
      ORDER BY s.created_at DESC
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
$$;

REVOKE ALL ON FUNCTION public.admin_list_payment_receipts(timestamptz, timestamptz, text, text, text, int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_list_payment_receipts(timestamptz, timestamptz, text, text, text, int) TO authenticated;

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

  -- MRR estimé : somme des prix mensuels des abonnements actifs
  -- (pour annuel, on divise par 12)
  SELECT COALESCE(SUM(
    CASE
      WHEN s.billing_cycle = 'annual' THEN COALESCE(sp.price_xof_annual, sp.price_xof * 12) / 12.0
      ELSE COALESCE(sp.price_xof, 0)
    END
  ), 0)
  INTO v_mrr
  FROM public.subscriptions s
  JOIN public.subscription_plans sp ON sp.id = s.plan_id
  WHERE s.status = 'active'
    AND s.current_period_end > now()
    AND sp.name <> 'free';

  -- Abonnés actifs par plan
  SELECT COALESCE(jsonb_object_agg(plan_name, cnt), '{}'::jsonb) INTO v_active_by_plan
  FROM (
    SELECT sp.name AS plan_name, COUNT(*) AS cnt
    FROM public.subscriptions s
    JOIN public.subscription_plans sp ON sp.id = s.plan_id
    WHERE s.status = 'active' AND s.current_period_end > now()
    GROUP BY sp.name
  ) q;

  -- Taux de remboursement (sur 90 derniers jours)
  SELECT
    COUNT(*) FILTER (WHERE created_at > now() - interval '90 days'),
    COUNT(*) FILTER (WHERE status = 'refunded' AND created_at > now() - interval '90 days')
  INTO v_total_receipts, v_refunded_receipts
  FROM public.payment_receipts;

  IF v_total_receipts > 0 THEN
    v_refund_rate := (v_refunded_receipts::numeric / v_total_receipts::numeric) * 100.0;
  END IF;

  -- Revenu du mois en cours par devise (status = confirmed)
  SELECT COALESCE(jsonb_object_agg(currency, total), '{}'::jsonb) INTO v_revenue_by_currency
  FROM (
    SELECT currency, SUM(amount) AS total
    FROM public.payment_receipts
    WHERE status = 'confirmed'
      AND created_at >= date_trunc('month', now())
    GROUP BY currency
  ) q;

  -- Revenu total mois (toutes devises confondues, pour info en XOF si présent)
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

REVOKE ALL ON FUNCTION public.admin_billing_kpis() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_billing_kpis() TO authenticated;
