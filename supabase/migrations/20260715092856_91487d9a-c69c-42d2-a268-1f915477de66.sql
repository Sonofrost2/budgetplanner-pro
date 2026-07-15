-- Backfill linked_transfer_id for legacy transfer pairs where description starts with "Transfert:"
WITH pairs AS (
  SELECT
    a.id AS income_id,
    b.id AS expense_id
  FROM public.transactions a
  JOIN public.transactions b
    ON a.user_id = b.user_id
   AND a.amount = b.amount
   AND a.description = b.description
   AND a.type = 'income'
   AND b.type = 'expense'
   AND abs(extract(epoch from (a.created_at - b.created_at))) < 5
  WHERE a.linked_transfer_id IS NULL
    AND b.linked_transfer_id IS NULL
    AND (a.description ILIKE 'Transfert:%' OR a.description ILIKE 'Transfer:%')
)
UPDATE public.transactions t
SET linked_transfer_id = CASE
  WHEN t.id = p.income_id THEN p.expense_id
  WHEN t.id = p.expense_id THEN p.income_id
END
FROM pairs p
WHERE t.id IN (p.income_id, p.expense_id);