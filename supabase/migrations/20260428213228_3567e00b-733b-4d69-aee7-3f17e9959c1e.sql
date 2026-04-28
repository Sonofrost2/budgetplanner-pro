-- Étendre perform_transfer pour pouvoir taguer la transaction "expense" avec une catégorie de budget.
-- Permet à une cotisation d'épargne liée à un budget de consommer ce budget automatiquement.
CREATE OR REPLACE FUNCTION public.perform_transfer(
  p_user_id uuid,
  p_from_account_id uuid,
  p_to_account_id uuid,
  p_amount numeric,
  p_description text,
  p_expense_category_id uuid DEFAULT NULL
)
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

  -- Si une catégorie est fournie, on vérifie qu'elle appartient bien à l'utilisateur.
  IF p_expense_category_id IS NOT NULL THEN
    PERFORM 1 FROM categories WHERE id = p_expense_category_id AND user_id = p_user_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Invalid category';
    END IF;
  END IF;

  INSERT INTO transactions (user_id, type, amount, description, account_id, date, notes, category_id)
  VALUES (
    p_user_id,
    'expense',
    p_amount,
    COALESCE(NULLIF(p_description, ''), 'Transfert: ' || v_from_name || ' → ' || v_to_name),
    p_from_account_id,
    v_today,
    '↗ ' || v_to_name,
    p_expense_category_id
  )
  RETURNING id INTO v_expense_id;

  INSERT INTO transactions (user_id, type, amount, description, account_id, date, notes)
  VALUES (
    p_user_id,
    'income',
    p_amount,
    COALESCE(NULLIF(p_description, ''), 'Transfert: ' || v_from_name || ' → ' || v_to_name),
    p_to_account_id,
    v_today,
    '↙ ' || v_from_name
  )
  RETURNING id INTO v_income_id;

  UPDATE transactions SET linked_transfer_id = v_income_id WHERE id = v_expense_id;
  UPDATE transactions SET linked_transfer_id = v_expense_id WHERE id = v_income_id;

  RETURN jsonb_build_object('expense_id', v_expense_id, 'income_id', v_income_id);
END;
$function$;