-- Add status column to savings_goals
ALTER TABLE public.savings_goals 
ADD COLUMN status text NOT NULL DEFAULT 'active';

-- Add index for filtering by status
CREATE INDEX idx_savings_goals_status ON public.savings_goals (user_id, status);
