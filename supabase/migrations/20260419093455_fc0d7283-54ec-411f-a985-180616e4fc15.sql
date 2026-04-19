
-- Add overloads that accept _actor_id explicitly (edge function context)
CREATE OR REPLACE FUNCTION public.admin_list_users(
  _actor_id uuid,
  _search text DEFAULT NULL,
  _plan_filter text DEFAULT NULL,
  _limit integer DEFAULT 100,
  _offset integer DEFAULT 0
)
RETURNS SETOF public.admin_user_overview
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NOT public.has_role(_actor_id, 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'admin role required';
  END IF;

  RETURN QUERY
  SELECT * FROM public.admin_user_overview ao
  WHERE (_search IS NULL OR ao.email ILIKE '%' || _search || '%' OR ao.display_name ILIKE '%' || _search || '%')
    AND (_plan_filter IS NULL OR ao.effective_plan = _plan_filter)
  ORDER BY ao.signup_at DESC
  LIMIT _limit OFFSET _offset;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_set_user_plan(
  _actor_id uuid,
  _target_user_id uuid,
  _plan_name text,
  _duration_days integer DEFAULT 30
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_plan_id uuid;
  v_end timestamptz := now() + make_interval(days => _duration_days);
BEGIN
  IF NOT public.has_role(_actor_id, 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'admin role required';
  END IF;

  SELECT id INTO v_plan_id FROM public.subscription_plans WHERE name = _plan_name LIMIT 1;
  IF v_plan_id IS NULL THEN
    RAISE EXCEPTION 'plan not found: %', _plan_name;
  END IF;

  INSERT INTO public.subscriptions (user_id, plan_id, status, current_period_start, current_period_end, payment_method)
  VALUES (_target_user_id, v_plan_id, 'active', now(), v_end, 'admin_override')
  ON CONFLICT (user_id) DO UPDATE
  SET plan_id = EXCLUDED.plan_id,
      status = 'active',
      current_period_start = now(),
      current_period_end = v_end,
      payment_method = 'admin_override',
      updated_at = now();

  RETURN jsonb_build_object('success', true, 'plan', _plan_name, 'expires_at', v_end);
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_suspicious_ips(_actor_id uuid)
RETURNS TABLE(
  ip_address inet,
  account_count bigint,
  user_ids uuid[],
  emails text[],
  first_seen timestamptz,
  last_seen timestamptz
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NOT public.has_role(_actor_id, 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'admin role required';
  END IF;

  RETURN QUERY
  SELECT
    df.ip_address,
    COUNT(DISTINCT df.user_id) AS account_count,
    ARRAY_AGG(DISTINCT df.user_id) AS user_ids,
    ARRAY_AGG(DISTINCT au.email::text) FILTER (WHERE au.email IS NOT NULL) AS emails,
    MIN(df.first_seen_at) AS first_seen,
    MAX(df.last_seen_at) AS last_seen
  FROM public.device_fingerprints df
  LEFT JOIN auth.users au ON au.id = df.user_id
  WHERE df.ip_address IS NOT NULL
  GROUP BY df.ip_address
  HAVING COUNT(DISTINCT df.user_id) >= 2
  ORDER BY account_count DESC;
END;
$$;
