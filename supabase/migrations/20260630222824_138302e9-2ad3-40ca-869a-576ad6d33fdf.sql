
CREATE OR REPLACE FUNCTION public.enforce_free_plan_monthly_limit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_plan text;
  v_count int;
  v_limit constant int := 15;
BEGIN
  -- Skip soft-deleted rows or system inserts without user
  IF NEW.user_id IS NULL THEN RETURN NEW; END IF;

  -- Effective plan for the user
  v_plan := COALESCE(public.is_subscription_valid(NEW.user_id), 'free');

  IF v_plan <> 'free' THEN
    RETURN NEW;
  END IF;

  SELECT COUNT(*) INTO v_count
  FROM public.transactions
  WHERE user_id = NEW.user_id
    AND deleted_at IS NULL
    AND date_trunc('month', created_at) = date_trunc('month', now());

  IF v_count >= v_limit THEN
    RAISE EXCEPTION 'PLAN_LIMIT_REACHED: Free plan limited to % transactions per month', v_limit
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_free_plan_monthly_limit ON public.transactions;
CREATE TRIGGER trg_enforce_free_plan_monthly_limit
BEFORE INSERT ON public.transactions
FOR EACH ROW
EXECUTE FUNCTION public.enforce_free_plan_monthly_limit();
