
-- Helper: returns effective plan tier for a user based on real DB subscription
CREATE OR REPLACE FUNCTION public.user_plan_tier(_user_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (
      SELECT sp.name
      FROM public.subscriptions s
      JOIN public.subscription_plans sp ON sp.id = s.plan_id
      WHERE s.user_id = _user_id
        AND s.status = 'active'
        AND s.current_period_end > now()
      ORDER BY s.created_at DESC
      LIMIT 1
    ),
    'free'
  );
$$;

REVOKE EXECUTE ON FUNCTION public.user_plan_tier(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.user_plan_tier(uuid) TO authenticated, service_role;

-- Rank helper: 0 free, 1 pro, 2 premium
CREATE OR REPLACE FUNCTION public.plan_rank(_plan text)
RETURNS int
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT CASE lower(COALESCE(_plan,'free'))
    WHEN 'premium' THEN 2
    WHEN 'pro' THEN 1
    ELSE 0
  END;
$$;

REVOKE EXECUTE ON FUNCTION public.plan_rank(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.plan_rank(text) TO authenticated, service_role;

-- Enforcement trigger: requires min tier 'pro'
CREATE OR REPLACE FUNCTION public.enforce_min_plan_pro()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_owner uuid;
  v_tier text;
BEGIN
  -- Service role and admins bypass (server-side, trusted)
  IF auth.role() = 'service_role' THEN
    RETURN NEW;
  END IF;

  -- Resolve the owning user id from row (support several columns)
  v_owner := COALESCE(
    NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid,
    auth.uid()
  );

  BEGIN
    v_owner := COALESCE(
      (to_jsonb(NEW) ->> 'user_id')::uuid,
      (to_jsonb(NEW) ->> 'owner_id')::uuid,
      v_owner
    );
  EXCEPTION WHEN others THEN
    NULL;
  END;

  IF v_owner IS NULL THEN
    RAISE EXCEPTION 'PLAN_REQUIRED: authentication required' USING ERRCODE = '42501';
  END IF;

  IF public.has_role(v_owner, 'admin'::public.app_role) THEN
    RETURN NEW;
  END IF;

  v_tier := public.user_plan_tier(v_owner);
  IF public.plan_rank(v_tier) < 1 THEN
    RAISE EXCEPTION 'PLAN_REQUIRED: this feature requires a paid plan (current: %)', v_tier
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.enforce_min_plan_pro() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.enforce_min_plan_pro() TO authenticated, service_role;

-- Attach triggers on paid-only tables
DROP TRIGGER IF EXISTS trg_enforce_plan_family_groups ON public.family_groups;
CREATE TRIGGER trg_enforce_plan_family_groups
  BEFORE INSERT ON public.family_groups
  FOR EACH ROW EXECUTE FUNCTION public.enforce_min_plan_pro();

DROP TRIGGER IF EXISTS trg_enforce_plan_assets ON public.assets;
CREATE TRIGGER trg_enforce_plan_assets
  BEFORE INSERT ON public.assets
  FOR EACH ROW EXECUTE FUNCTION public.enforce_min_plan_pro();

DROP TRIGGER IF EXISTS trg_enforce_plan_recurring ON public.recurring_transactions;
CREATE TRIGGER trg_enforce_plan_recurring
  BEFORE INSERT ON public.recurring_transactions
  FOR EACH ROW EXECUTE FUNCTION public.enforce_min_plan_pro();
