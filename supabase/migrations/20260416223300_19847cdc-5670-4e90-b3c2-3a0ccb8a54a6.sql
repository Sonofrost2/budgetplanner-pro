-- ─────────────────────────────────────────────────────────────
-- Phase E — Soft delete (Corbeille)
-- ─────────────────────────────────────────────────────────────

ALTER TABLE public.transactions          ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
ALTER TABLE public.budgets               ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
ALTER TABLE public.debts                 ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
ALTER TABLE public.savings_goals         ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
ALTER TABLE public.payment_accounts      ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
ALTER TABLE public.categories            ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
ALTER TABLE public.recurring_transactions ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

-- Partial indexes for active rows (most common queries)
CREATE INDEX IF NOT EXISTS idx_transactions_active        ON public.transactions(user_id, date DESC)        WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_budgets_active             ON public.budgets(user_id)                        WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_debts_active               ON public.debts(user_id)                          WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_savings_goals_active       ON public.savings_goals(user_id)                  WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_payment_accounts_active    ON public.payment_accounts(user_id)               WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_categories_active          ON public.categories(user_id)                     WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_recurring_active           ON public.recurring_transactions(user_id)         WHERE deleted_at IS NULL;

-- Index for trash queries (deleted rows)
CREATE INDEX IF NOT EXISTS idx_transactions_trash        ON public.transactions(user_id, deleted_at)        WHERE deleted_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_budgets_trash             ON public.budgets(user_id, deleted_at)             WHERE deleted_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_debts_trash               ON public.debts(user_id, deleted_at)               WHERE deleted_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_savings_goals_trash       ON public.savings_goals(user_id, deleted_at)       WHERE deleted_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_payment_accounts_trash    ON public.payment_accounts(user_id, deleted_at)    WHERE deleted_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_categories_trash          ON public.categories(user_id, deleted_at)          WHERE deleted_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_recurring_trash           ON public.recurring_transactions(user_id, deleted_at) WHERE deleted_at IS NOT NULL;

-- ─────────────────────────────────────────────────────────────
-- Auto-purge function (older than 30 days in trash)
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.cleanup_old_deleted()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_counts jsonb := '{}'::jsonb;
  v_n integer;
BEGIN
  DELETE FROM public.transactions          WHERE deleted_at IS NOT NULL AND deleted_at < now() - interval '30 days';
  GET DIAGNOSTICS v_n = ROW_COUNT; v_counts := v_counts || jsonb_build_object('transactions', v_n);

  DELETE FROM public.budgets               WHERE deleted_at IS NOT NULL AND deleted_at < now() - interval '30 days';
  GET DIAGNOSTICS v_n = ROW_COUNT; v_counts := v_counts || jsonb_build_object('budgets', v_n);

  DELETE FROM public.debts                 WHERE deleted_at IS NOT NULL AND deleted_at < now() - interval '30 days';
  GET DIAGNOSTICS v_n = ROW_COUNT; v_counts := v_counts || jsonb_build_object('debts', v_n);

  DELETE FROM public.savings_goals         WHERE deleted_at IS NOT NULL AND deleted_at < now() - interval '30 days';
  GET DIAGNOSTICS v_n = ROW_COUNT; v_counts := v_counts || jsonb_build_object('savings_goals', v_n);

  DELETE FROM public.payment_accounts      WHERE deleted_at IS NOT NULL AND deleted_at < now() - interval '30 days';
  GET DIAGNOSTICS v_n = ROW_COUNT; v_counts := v_counts || jsonb_build_object('payment_accounts', v_n);

  DELETE FROM public.categories            WHERE deleted_at IS NOT NULL AND deleted_at < now() - interval '30 days';
  GET DIAGNOSTICS v_n = ROW_COUNT; v_counts := v_counts || jsonb_build_object('categories', v_n);

  DELETE FROM public.recurring_transactions WHERE deleted_at IS NOT NULL AND deleted_at < now() - interval '30 days';
  GET DIAGNOSTICS v_n = ROW_COUNT; v_counts := v_counts || jsonb_build_object('recurring_transactions', v_n);

  RETURN v_counts;
END;
$$;

-- ─────────────────────────────────────────────────────────────
-- Cancel transfer (atomically soft-delete both legs)
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.cancel_transfer(p_user_id uuid, p_transaction_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_linked_id uuid;
  v_owner uuid;
BEGIN
  SELECT linked_transfer_id, user_id INTO v_linked_id, v_owner
  FROM transactions WHERE id = p_transaction_id;

  IF v_owner IS NULL OR v_owner <> p_user_id THEN
    RAISE EXCEPTION 'Transaction not found or unauthorized';
  END IF;
  IF v_linked_id IS NULL THEN
    RAISE EXCEPTION 'Not a transfer transaction';
  END IF;

  UPDATE transactions SET deleted_at = now()
  WHERE user_id = p_user_id
    AND id IN (p_transaction_id, v_linked_id)
    AND deleted_at IS NULL;

  RETURN jsonb_build_object('cancelled', true, 'ids', jsonb_build_array(p_transaction_id, v_linked_id));
END;
$$;

-- ─────────────────────────────────────────────────────────────
-- Update transfer (sync both legs)
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.update_transfer(
  p_user_id uuid,
  p_transaction_id uuid,
  p_amount numeric,
  p_description text,
  p_from_account_id uuid,
  p_to_account_id uuid,
  p_date date
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_linked_id uuid;
  v_owner uuid;
  v_type text;
  v_expense_id uuid;
  v_income_id uuid;
  v_from_name text;
  v_to_name text;
  v_desc text;
BEGIN
  IF p_amount <= 0 THEN RAISE EXCEPTION 'Amount must be positive'; END IF;
  IF p_from_account_id = p_to_account_id THEN RAISE EXCEPTION 'Source and destination must differ'; END IF;

  SELECT linked_transfer_id, user_id, type INTO v_linked_id, v_owner, v_type
  FROM transactions WHERE id = p_transaction_id;

  IF v_owner IS NULL OR v_owner <> p_user_id THEN
    RAISE EXCEPTION 'Transaction not found or unauthorized';
  END IF;
  IF v_linked_id IS NULL THEN
    RAISE EXCEPTION 'Not a transfer transaction';
  END IF;

  -- Identify expense / income legs
  IF v_type = 'expense' THEN
    v_expense_id := p_transaction_id;
    v_income_id  := v_linked_id;
  ELSE
    v_expense_id := v_linked_id;
    v_income_id  := p_transaction_id;
  END IF;

  SELECT name INTO v_from_name FROM payment_accounts WHERE id = p_from_account_id AND user_id = p_user_id;
  SELECT name INTO v_to_name   FROM payment_accounts WHERE id = p_to_account_id   AND user_id = p_user_id;
  IF v_from_name IS NULL OR v_to_name IS NULL THEN RAISE EXCEPTION 'Invalid account(s)'; END IF;

  v_desc := COALESCE(NULLIF(p_description, ''), 'Transfert: ' || v_from_name || ' → ' || v_to_name);

  UPDATE transactions
  SET amount = p_amount, description = v_desc, account_id = p_from_account_id,
      date = p_date, notes = '↗ ' || v_to_name, updated_at = now()
  WHERE id = v_expense_id AND user_id = p_user_id;

  UPDATE transactions
  SET amount = p_amount, description = v_desc, account_id = p_to_account_id,
      date = p_date, notes = '↙ ' || v_from_name, updated_at = now()
  WHERE id = v_income_id AND user_id = p_user_id;

  RETURN jsonb_build_object('expense_id', v_expense_id, 'income_id', v_income_id);
END;
$$;