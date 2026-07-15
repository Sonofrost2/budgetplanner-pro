
-- P1.1 — Ledger dédié pour les mouvements d'épargne (audit trail)
CREATE TABLE IF NOT EXISTS public.savings_goal_transactions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  goal_id UUID NOT NULL REFERENCES public.savings_goals(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('deposit','withdrawal','interest','adjustment','sync')),
  amount NUMERIC NOT NULL CHECK (amount >= 0),
  source_account_id UUID REFERENCES public.payment_accounts(id) ON DELETE SET NULL,
  transaction_id UUID REFERENCES public.transactions(id) ON DELETE SET NULL,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.savings_goal_transactions TO authenticated;
GRANT ALL ON public.savings_goal_transactions TO service_role;

ALTER TABLE public.savings_goal_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sgt_owner_select" ON public.savings_goal_transactions
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "sgt_owner_insert" ON public.savings_goal_transactions
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_sgt_goal ON public.savings_goal_transactions(goal_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sgt_user ON public.savings_goal_transactions(user_id, created_at DESC);

-- P1.4 — Trigger auto-complete quand target atteinte
CREATE OR REPLACE FUNCTION public.auto_complete_savings_goal()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Si un objectif actif atteint 100%, on le marque completed automatiquement.
  IF NEW.status = 'active'
     AND COALESCE(OLD.status, 'active') = 'active'
     AND NEW.target_amount > 0
     AND NEW.current_amount >= NEW.target_amount
     AND NEW.deleted_at IS NULL
     AND NEW.paused_at IS NULL
  THEN
    NEW.status := 'completed';
  END IF;

  -- Si on retire des fonds et qu'on repasse sous la cible, on peut réactiver
  -- un objectif complété non archivé (utile après retrait partiel).
  IF NEW.status = 'completed'
     AND NEW.target_amount > 0
     AND NEW.current_amount < NEW.target_amount
     AND NEW.deleted_at IS NULL
     AND NEW.paused_at IS NULL
     AND OLD.status = 'completed'
  THEN
    NEW.status := 'active';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_auto_complete_savings_goal ON public.savings_goals;
CREATE TRIGGER trg_auto_complete_savings_goal
  BEFORE UPDATE OF current_amount, target_amount ON public.savings_goals
  FOR EACH ROW EXECUTE FUNCTION public.auto_complete_savings_goal();

-- P1.1 — RPC sécurisée pour retirer d'un objectif d'épargne
-- Vérifie : ownership, is_locked, deleted_at, paused_at, solde suffisant.
CREATE OR REPLACE FUNCTION public.withdraw_from_goal(
  p_goal_id UUID,
  p_amount NUMERIC,
  p_destination_account_id UUID,
  p_note TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_goal RECORD;
  v_new_amount NUMERIC;
  v_tx_id UUID;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'NOT_AUTHENTICATED' USING ERRCODE = '42501';
  END IF;
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'INVALID_AMOUNT' USING ERRCODE = '22023';
  END IF;
  IF p_destination_account_id IS NULL THEN
    RAISE EXCEPTION 'DESTINATION_ACCOUNT_REQUIRED' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_goal FROM public.savings_goals
    WHERE id = p_goal_id AND user_id = v_uid FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'GOAL_NOT_FOUND' USING ERRCODE = 'P0002';
  END IF;
  IF v_goal.deleted_at IS NOT NULL THEN
    RAISE EXCEPTION 'GOAL_DELETED' USING ERRCODE = '42501';
  END IF;
  IF v_goal.is_locked THEN
    RAISE EXCEPTION 'GOAL_LOCKED' USING ERRCODE = '42501';
  END IF;
  IF v_goal.current_amount < p_amount THEN
    RAISE EXCEPTION 'INSUFFICIENT_BALANCE' USING ERRCODE = '22023';
  END IF;

  -- Vérifie que le compte destination appartient à l'utilisateur
  PERFORM 1 FROM public.payment_accounts
    WHERE id = p_destination_account_id AND user_id = v_uid AND archived_at IS NULL;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'DESTINATION_ACCOUNT_INVALID' USING ERRCODE = '22023';
  END IF;

  v_new_amount := v_goal.current_amount - p_amount;

  UPDATE public.savings_goals
    SET current_amount = v_new_amount, updated_at = now()
    WHERE id = p_goal_id;

  INSERT INTO public.transactions (user_id, type, amount, description, account_id, date)
    VALUES (v_uid, 'income', p_amount,
            COALESCE(p_note, 'Retrait épargne: ' || v_goal.name),
            p_destination_account_id, CURRENT_DATE)
    RETURNING id INTO v_tx_id;

  INSERT INTO public.savings_goal_transactions
    (goal_id, user_id, kind, amount, source_account_id, transaction_id, note)
    VALUES (p_goal_id, v_uid, 'withdrawal', p_amount, p_destination_account_id, v_tx_id, p_note);

  RETURN jsonb_build_object(
    'ok', true,
    'goal_id', p_goal_id,
    'new_amount', v_new_amount,
    'transaction_id', v_tx_id
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.withdraw_from_goal(UUID, NUMERIC, UUID, TEXT) TO authenticated;
