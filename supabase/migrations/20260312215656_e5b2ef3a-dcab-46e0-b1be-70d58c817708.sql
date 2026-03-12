ALTER TABLE public.savings_goals ADD COLUMN monthly_contribution numeric DEFAULT 0;
ALTER TABLE public.savings_goals ADD COLUMN start_date date DEFAULT CURRENT_DATE;