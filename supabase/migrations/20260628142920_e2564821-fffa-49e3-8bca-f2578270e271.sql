
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS activation_completed_at timestamptz,
  ADD COLUMN IF NOT EXISTS activation_dismissed_at timestamptz,
  ADD COLUMN IF NOT EXISTS activation_reminders_sent jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS categories_visited_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_profiles_activation_pending
  ON public.profiles (created_at)
  WHERE onboarding_completed = true
    AND activation_completed_at IS NULL
    AND activation_dismissed_at IS NULL;
