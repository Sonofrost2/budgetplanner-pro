
ALTER TABLE public.budgets
  ADD COLUMN expected_day integer DEFAULT NULL,
  ADD COLUMN occurrence_frequency text DEFAULT NULL;

COMMENT ON COLUMN public.budgets.expected_day IS 'Day of the month (1-31) when this budget item is expected. For weekly budgets, day of the week (1=Mon, 7=Sun).';
COMMENT ON COLUMN public.budgets.occurrence_frequency IS 'How often the expense/income occurs within the budget period: once, daily, weekly, biweekly, monthly, quarterly, semi_annual, yearly';
