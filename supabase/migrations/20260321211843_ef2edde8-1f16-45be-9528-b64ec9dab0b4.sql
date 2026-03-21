
-- 1) Neutralize recalculate_account_balance to be a no-op
CREATE OR REPLACE FUNCTION public.recalculate_account_balance(p_account_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- No-op: real_balance is now manually managed by the user only
  -- Theoretical balance is calculated client-side from opening_balance + transactions
  NULL;
END;
$function$;

-- 2) Update perform_transfer to NOT touch real_balance
CREATE OR REPLACE FUNCTION public.perform_transfer(p_user_id uuid, p_from_account_id uuid, p_to_account_id uuid, p_amount numeric, p_description text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_expense_id uuid;
  v_income_id uuid;
  v_today date := CURRENT_DATE;
  v_from_name text;
  v_to_name text;
BEGIN
  IF p_from_account_id = p_to_account_id THEN
    RAISE EXCEPTION 'Source and destination accounts must be different';
  END IF;
  IF p_amount <= 0 THEN
    RAISE EXCEPTION 'Amount must be positive';
  END IF;

  SELECT name INTO v_from_name FROM payment_accounts WHERE id = p_from_account_id AND user_id = p_user_id;
  SELECT name INTO v_to_name FROM payment_accounts WHERE id = p_to_account_id AND user_id = p_user_id;
  
  IF v_from_name IS NULL OR v_to_name IS NULL THEN
    RAISE EXCEPTION 'Invalid account(s)';
  END IF;

  INSERT INTO transactions (user_id, type, amount, description, account_id, date, notes)
  VALUES (p_user_id, 'expense', p_amount, COALESCE(NULLIF(p_description, ''), 'Transfert: ' || v_from_name || ' → ' || v_to_name), p_from_account_id, v_today, '↗ ' || v_to_name)
  RETURNING id INTO v_expense_id;

  INSERT INTO transactions (user_id, type, amount, description, account_id, date, notes)
  VALUES (p_user_id, 'income', p_amount, COALESCE(NULLIF(p_description, ''), 'Transfert: ' || v_from_name || ' → ' || v_to_name), p_to_account_id, v_today, '↙ ' || v_from_name)
  RETURNING id INTO v_income_id;

  UPDATE transactions SET linked_transfer_id = v_income_id WHERE id = v_expense_id;
  UPDATE transactions SET linked_transfer_id = v_expense_id WHERE id = v_income_id;

  -- real_balance is no longer auto-updated; user manages it manually

  RETURN jsonb_build_object('expense_id', v_expense_id, 'income_id', v_income_id);
END;
$function$;

-- 3) Enable realtime for key tables
ALTER PUBLICATION supabase_realtime ADD TABLE public.transactions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.payment_accounts;
ALTER PUBLICATION supabase_realtime ADD TABLE public.budgets;
ALTER PUBLICATION supabase_realtime ADD TABLE public.categories;
ALTER PUBLICATION supabase_realtime ADD TABLE public.savings_goals;
ALTER PUBLICATION supabase_realtime ADD TABLE public.debts;
ALTER PUBLICATION supabase_realtime ADD TABLE public.recurring_transactions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.cash_counts;
