-- Link a recurring transaction to a savings goal for automatic deposits.
-- When the recurring engine materializes a transaction, if this column is set
-- and the transaction type is 'expense' (money leaving an account), it also
-- credits the linked savings goal via the savings_goal_transactions ledger.

ALTER TABLE public.recurring_transactions
  ADD COLUMN IF NOT EXISTS savings_goal_id uuid
  REFERENCES public.savings_goals(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_recurring_tx_savings_goal
  ON public.recurring_transactions(savings_goal_id)
  WHERE savings_goal_id IS NOT NULL;

COMMENT ON COLUMN public.recurring_transactions.savings_goal_id IS
  'Optional link to a savings goal. When set, the recurring engine also credits this goal at each materialization.';
