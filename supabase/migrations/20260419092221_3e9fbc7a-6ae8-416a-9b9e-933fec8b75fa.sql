-- ============================================================
-- 1. AUDIT LOGS
-- ============================================================
CREATE TABLE public.audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,                         -- nullable: actions système possibles
  actor_id uuid,                        -- qui a fait l'action (admin ou user lui-même)
  event_type text NOT NULL,             -- 'ai_call','export','admin_action','login','payment','plan_change','ban','delete'
  event_subtype text,                   -- ex: 'ai-chat', 'csv_export', 'set_plan'
  resource_id text,                     -- id de la ressource concernée (libre)
  status text NOT NULL DEFAULT 'success', -- 'success','denied','error'
  reason text,                          -- raison du denied / message d'erreur
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  ip_address inet,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_audit_logs_user_id ON public.audit_logs (user_id, created_at DESC);
CREATE INDEX idx_audit_logs_actor_id ON public.audit_logs (actor_id, created_at DESC);
CREATE INDEX idx_audit_logs_event_type ON public.audit_logs (event_type, created_at DESC);
CREATE INDEX idx_audit_logs_ip ON public.audit_logs (ip_address, created_at DESC);

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own audit logs"
  ON public.audit_logs FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Deny client inserts on audit_logs"
  ON public.audit_logs FOR INSERT TO authenticated WITH CHECK (false);
CREATE POLICY "Deny client updates on audit_logs"
  ON public.audit_logs FOR UPDATE TO authenticated USING (false);
CREATE POLICY "Deny client deletes on audit_logs"
  ON public.audit_logs FOR DELETE TO authenticated USING (false);


-- ============================================================
-- 2. USAGE COUNTERS (quotas quotidiens)
-- ============================================================
CREATE TABLE public.usage_counters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  feature text NOT NULL,                -- 'ai_call', 'export', etc.
  day date NOT NULL DEFAULT CURRENT_DATE,
  count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, feature, day)
);

CREATE INDEX idx_usage_counters_user_day ON public.usage_counters (user_id, day DESC);

ALTER TABLE public.usage_counters ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own usage"
  ON public.usage_counters FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Deny client inserts on usage_counters"
  ON public.usage_counters FOR INSERT TO authenticated WITH CHECK (false);
CREATE POLICY "Deny client updates on usage_counters"
  ON public.usage_counters FOR UPDATE TO authenticated USING (false);
CREATE POLICY "Deny client deletes on usage_counters"
  ON public.usage_counters FOR DELETE TO authenticated USING (false);


-- ============================================================
-- 3. DEVICE FINGERPRINTS
-- ============================================================
CREATE TABLE public.device_fingerprints (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  fingerprint text NOT NULL,            -- hash client (canvas + UA + timezone)
  ip_address inet,
  user_agent text,
  first_seen_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, fingerprint)
);

CREATE INDEX idx_device_fp_user ON public.device_fingerprints (user_id);
CREATE INDEX idx_device_fp_fp ON public.device_fingerprints (fingerprint);
CREATE INDEX idx_device_fp_ip ON public.device_fingerprints (ip_address);

ALTER TABLE public.device_fingerprints ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin read all fingerprints"
  ON public.device_fingerprints FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR auth.uid() = user_id);

CREATE POLICY "Users insert own fingerprints"
  ON public.device_fingerprints FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own fingerprints"
  ON public.device_fingerprints FOR UPDATE TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Deny client deletes on device_fingerprints"
  ON public.device_fingerprints FOR DELETE TO authenticated USING (false);


-- ============================================================
-- 4. HELPERS
-- ============================================================

-- Vérifie qu'une souscription est valide ET non expirée
CREATE OR REPLACE FUNCTION public.is_subscription_valid(_user_id uuid)
RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT COALESCE(sp.name, 'free')
  FROM public.subscriptions s
  LEFT JOIN public.subscription_plans sp ON sp.id = s.plan_id
  WHERE s.user_id = _user_id
    AND s.status = 'active'
    AND s.current_period_end > now()
  ORDER BY s.created_at DESC
  LIMIT 1;
$$;

-- Vérifie quota et incrémente atomiquement
CREATE OR REPLACE FUNCTION public.check_and_increment_usage(
  _user_id uuid,
  _feature text,
  _limit integer
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_current integer;
  v_new integer;
BEGIN
  IF _limit IS NULL OR _limit < 0 THEN
    -- illimité : on incrémente quand même pour stats
    INSERT INTO public.usage_counters (user_id, feature, day, count)
    VALUES (_user_id, _feature, CURRENT_DATE, 1)
    ON CONFLICT (user_id, feature, day)
    DO UPDATE SET count = usage_counters.count + 1, updated_at = now()
    RETURNING count INTO v_new;
    RETURN jsonb_build_object('allowed', true, 'used', v_new, 'limit', null, 'remaining', null);
  END IF;

  SELECT count INTO v_current
  FROM public.usage_counters
  WHERE user_id = _user_id AND feature = _feature AND day = CURRENT_DATE;

  v_current := COALESCE(v_current, 0);

  IF v_current >= _limit THEN
    RETURN jsonb_build_object('allowed', false, 'used', v_current, 'limit', _limit, 'remaining', 0);
  END IF;

  INSERT INTO public.usage_counters (user_id, feature, day, count)
  VALUES (_user_id, _feature, CURRENT_DATE, 1)
  ON CONFLICT (user_id, feature, day)
  DO UPDATE SET count = usage_counters.count + 1, updated_at = now()
  RETURNING count INTO v_new;

  RETURN jsonb_build_object('allowed', true, 'used', v_new, 'limit', _limit, 'remaining', _limit - v_new);
END;
$$;

-- Log d'événement (utilisable par Edge Functions via service role)
CREATE OR REPLACE FUNCTION public.log_audit_event(
  _user_id uuid,
  _actor_id uuid,
  _event_type text,
  _event_subtype text,
  _status text,
  _reason text,
  _metadata jsonb,
  _ip text,
  _user_agent text,
  _resource_id text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_id uuid;
  v_ip inet;
BEGIN
  BEGIN v_ip := _ip::inet; EXCEPTION WHEN OTHERS THEN v_ip := NULL; END;
  INSERT INTO public.audit_logs (
    user_id, actor_id, event_type, event_subtype, resource_id,
    status, reason, metadata, ip_address, user_agent
  ) VALUES (
    _user_id, _actor_id, _event_type, _event_subtype, _resource_id,
    _status, _reason, COALESCE(_metadata, '{}'::jsonb), v_ip, _user_agent
  )
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;


-- ============================================================
-- 5. ADMIN OVERVIEW VIEW (security_invoker → respecte RLS)
-- ============================================================
CREATE OR REPLACE VIEW public.admin_user_overview
WITH (security_invoker = on) AS
SELECT 
  u.id AS user_id,
  u.email,
  u.created_at AS signup_at,
  u.last_sign_in_at,
  u.banned_until,
  u.email_confirmed_at,
  p.display_name,
  p.avatar_url,
  p.locale,
  p.currency,
  COALESCE(public.is_subscription_valid(u.id), 'free') AS effective_plan,
  s.current_period_end AS plan_expires_at,
  s.status AS subscription_status,
  EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = u.id AND ur.role = 'admin') AS is_admin,
  (SELECT COUNT(*) FROM public.transactions t WHERE t.user_id = u.id AND t.deleted_at IS NULL) AS tx_count,
  (SELECT COUNT(*) FROM public.payment_accounts pa WHERE pa.user_id = u.id AND pa.deleted_at IS NULL) AS account_count
FROM auth.users u
LEFT JOIN public.profiles p ON p.user_id = u.id
LEFT JOIN LATERAL (
  SELECT current_period_end, status
  FROM public.subscriptions
  WHERE user_id = u.id AND status = 'active'
  ORDER BY created_at DESC LIMIT 1
) s ON TRUE;

-- View only admins can read (relies on view's reference to user_roles via has_role in funcs)
-- Since view is security_invoker, base table auth.users is restricted; we expose via SECURITY DEFINER func instead.

REVOKE ALL ON public.admin_user_overview FROM PUBLIC;
REVOKE ALL ON public.admin_user_overview FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.admin_list_users(
  _search text DEFAULT NULL,
  _plan_filter text DEFAULT NULL,
  _limit integer DEFAULT 100,
  _offset integer DEFAULT 0
)
RETURNS SETOF public.admin_user_overview
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT has_role(auth.uid(), 'admin'::app_role) THEN
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

GRANT EXECUTE ON FUNCTION public.admin_list_users(text, text, integer, integer) TO authenticated;


-- ============================================================
-- 6. SUSPICIOUS ACCOUNTS VIEW (≥3 comptes / IP / 7j)
-- ============================================================
CREATE OR REPLACE FUNCTION public.admin_suspicious_ips()
RETURNS TABLE (
  ip_address inet,
  account_count bigint,
  user_ids uuid[],
  emails text[],
  first_seen timestamptz,
  last_seen timestamptz
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'admin role required';
  END IF;

  RETURN QUERY
  SELECT 
    df.ip_address,
    COUNT(DISTINCT df.user_id) AS account_count,
    ARRAY_AGG(DISTINCT df.user_id) AS user_ids,
    ARRAY_AGG(DISTINCT u.email) AS emails,
    MIN(df.first_seen_at) AS first_seen,
    MAX(df.last_seen_at) AS last_seen
  FROM public.device_fingerprints df
  LEFT JOIN auth.users u ON u.id = df.user_id
  WHERE df.last_seen_at > now() - interval '7 days'
    AND df.ip_address IS NOT NULL
  GROUP BY df.ip_address
  HAVING COUNT(DISTINCT df.user_id) >= 3
  ORDER BY account_count DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_suspicious_ips() TO authenticated;


-- ============================================================
-- 7. ADMIN ACTIONS
-- ============================================================
CREATE OR REPLACE FUNCTION public.admin_set_user_plan(
  _target_user_id uuid,
  _plan_name text,
  _duration_days integer DEFAULT 30
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_plan_id uuid;
BEGIN
  IF NOT has_role(v_actor, 'admin'::app_role) THEN
    RAISE EXCEPTION 'admin role required';
  END IF;
  IF _plan_name NOT IN ('free','pro','premium') THEN
    RAISE EXCEPTION 'invalid plan';
  END IF;

  IF _plan_name = 'free' THEN
    UPDATE public.subscriptions SET status = 'canceled', canceled_at = now(), updated_at = now()
    WHERE user_id = _target_user_id AND status = 'active';
  ELSE
    SELECT id INTO v_plan_id FROM public.subscription_plans WHERE name = _plan_name AND active = true LIMIT 1;
    IF v_plan_id IS NULL THEN RAISE EXCEPTION 'plan not found'; END IF;

    UPDATE public.subscriptions SET status = 'canceled', canceled_at = now(), updated_at = now()
    WHERE user_id = _target_user_id AND status = 'active';

    INSERT INTO public.subscriptions (user_id, plan_id, status, current_period_start, current_period_end, payment_method)
    VALUES (_target_user_id, v_plan_id, 'active', now(), now() + (_duration_days || ' days')::interval, 'admin_grant');
  END IF;

  PERFORM public.log_audit_event(
    _target_user_id, v_actor, 'admin_action', 'set_plan', 'success',
    'Admin set plan to ' || _plan_name,
    jsonb_build_object('plan', _plan_name, 'duration_days', _duration_days),
    NULL, NULL, _target_user_id::text
  );

  RETURN jsonb_build_object('success', true, 'plan', _plan_name);
END;
$$;
GRANT EXECUTE ON FUNCTION public.admin_set_user_plan(uuid, text, integer) TO authenticated;


CREATE OR REPLACE FUNCTION public.admin_log_action(
  _target_user_id uuid,
  _action text,
  _reason text DEFAULT NULL,
  _metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_actor uuid := auth.uid();
BEGIN
  IF NOT has_role(v_actor, 'admin'::app_role) THEN
    RAISE EXCEPTION 'admin role required';
  END IF;
  RETURN public.log_audit_event(
    _target_user_id, v_actor, 'admin_action', _action, 'success',
    _reason, _metadata, NULL, NULL, _target_user_id::text
  );
END;
$$;
GRANT EXECUTE ON FUNCTION public.admin_log_action(uuid, text, text, jsonb) TO authenticated;