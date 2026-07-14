
-- 1. Add is_transfer column
ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS is_transfer boolean NOT NULL DEFAULT false;

-- 2. Backfill existing transfers
UPDATE public.transactions
SET is_transfer = true
WHERE is_transfer = false
  AND (
    linked_transfer_id IS NOT NULL
    OR notes LIKE '↗ %'
    OR notes LIKE '↙ %'
  );

-- 3. Index for filtered queries
CREATE INDEX IF NOT EXISTS idx_transactions_user_transfer_date
  ON public.transactions (user_id, is_transfer, date DESC);

-- 4. Drop old overload (without p_date) to avoid ambiguity
DROP FUNCTION IF EXISTS public.perform_transfer(uuid, uuid, uuid, numeric, text, uuid);

-- 5. Replace perform_transfer: set is_transfer=true on both legs and link them
CREATE OR REPLACE FUNCTION public.perform_transfer(
  p_user_id uuid,
  p_from_account_id uuid,
  p_to_account_id uuid,
  p_amount numeric,
  p_description text,
  p_expense_category_id uuid DEFAULT NULL::uuid,
  p_date date DEFAULT CURRENT_DATE
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_expense_id uuid;
  v_income_id uuid;
  v_from_name text;
  v_to_name text;
  v_plan text;
  v_is_admin boolean;
  v_month_count int;
  v_free_limit int := 15;
  v_transfer_cost int := 2;
BEGIN
  IF p_from_account_id = p_to_account_id THEN
    RAISE EXCEPTION 'Source and destination accounts must be different';
  END IF;

  IF p_amount <= 0 THEN
    RAISE EXCEPTION 'Amount must be positive';
  END IF;

  SELECT EXISTS(
    SELECT 1 FROM public.user_roles
    WHERE user_id = p_user_id AND role = 'admin'
  ) INTO v_is_admin;

  IF NOT v_is_admin THEN
    SELECT COALESCE(public.is_subscription_valid(p_user_id), 'free') INTO v_plan;

    IF v_plan = 'free' THEN
      SELECT COUNT(*)
      INTO v_month_count
      FROM public.transactions
      WHERE user_id = p_user_id
        AND deleted_at IS NULL
        AND is_transfer = false
        AND date >= date_trunc('month', CURRENT_DATE)::date
        AND date <  (date_trunc('month', CURRENT_DATE) + interval '1 month')::date;

      IF v_month_count + v_transfer_cost > v_free_limit THEN
        RAISE EXCEPTION 'PLAN_LIMIT_REACHED: Monthly transaction limit reached (%). Upgrade to Pro for unlimited transfers.', v_free_limit
          USING ERRCODE = 'P0001';
      END IF;
    END IF;
  END IF;

  SELECT name INTO v_from_name
  FROM public.payment_accounts
  WHERE id = p_from_account_id AND user_id = p_user_id;

  SELECT name INTO v_to_name
  FROM public.payment_accounts
  WHERE id = p_to_account_id AND user_id = p_user_id;

  IF v_from_name IS NULL OR v_to_name IS NULL THEN
    RAISE EXCEPTION 'Invalid account(s)';
  END IF;

  IF p_expense_category_id IS NOT NULL THEN
    PERFORM 1 FROM public.categories
    WHERE id = p_expense_category_id AND user_id = p_user_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Invalid category';
    END IF;
  END IF;

  INSERT INTO public.transactions (user_id, type, amount, description, account_id, date, notes, category_id, is_transfer)
  VALUES (
    p_user_id, 'expense', p_amount,
    COALESCE(NULLIF(p_description, ''), 'Transfert: ' || v_from_name || ' → ' || v_to_name),
    p_from_account_id, p_date, '↗ ' || v_to_name, p_expense_category_id, true
  )
  RETURNING id INTO v_expense_id;

  INSERT INTO public.transactions (user_id, type, amount, description, account_id, date, notes, category_id, is_transfer)
  VALUES (
    p_user_id, 'income', p_amount,
    COALESCE(NULLIF(p_description, ''), 'Transfert: ' || v_from_name || ' → ' || v_to_name),
    p_to_account_id, p_date, '↙ ' || v_from_name, NULL, true
  )
  RETURNING id INTO v_income_id;

  -- Restore the link between the two legs (lost in recent revisions)
  UPDATE public.transactions SET linked_transfer_id = v_income_id  WHERE id = v_expense_id;
  UPDATE public.transactions SET linked_transfer_id = v_expense_id WHERE id = v_income_id;

  RETURN jsonb_build_object('expense_id', v_expense_id, 'income_id', v_income_id);
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.perform_transfer(uuid, uuid, uuid, numeric, text, uuid, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.perform_transfer(uuid, uuid, uuid, numeric, text, uuid, date) TO authenticated, service_role;
